import { useMutation, useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import { PermissionDeniedError } from '@/lib/errors'
import { db } from '@/lib/db'
import { resizeToJpeg } from '@/lib/image'
import { normalize } from '@/lib/normalize'
import { supabase } from '@/lib/supabase'
import { PHOTO_BUCKET, syncHousehold } from '@/lib/sync'
import type { KeyRow } from '@/types/models'
import type { KeyFormOut } from './schemas'

// ---------- Reads (Dexie) ----------

export function useKeys(hid: string): KeyRow[] | undefined {
  return useLiveQuery(() => db.keys.where('household_id').equals(hid).toArray(), [hid])
}

export function useKey(hid: string, kid: string): KeyRow | null | undefined {
  return useLiveQuery(async () => {
    const k = await db.keys.get(kid)
    return k && k.household_id === hid ? k : null
  }, [hid, kid])
}

export function useKeysForDoor(hid: string, did: string): KeyRow[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.keys.where('door_id').equals(did).toArray())
        .filter((k) => k.household_id === hid)
        .sort(
          (a, b) =>
            (a.label ?? '').localeCompare(b.label ?? '', undefined, { numeric: true }) ||
            a.created_at.localeCompare(b.created_at),
        ),
    [hid, did],
  )
}

export async function findKeyByTag(hid: string, tagId: string): Promise<KeyRow | undefined> {
  return db.keys.where('[household_id+tag_id]').equals([hid, tagId]).first()
}

/** Object URL for the cached thumbnail (offline-safe). */
export function useThumbUrl(keyId: string | null | undefined): string | null {
  const blob = useLiveQuery(
    async () => (keyId ? ((await db.thumbs.get(keyId))?.blob ?? null) : null),
    [keyId],
  )
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

/** Signed URL for the full-size photo (online only). */
export function useSignedPhotoUrl(path: string | null, version: string) {
  return useQuery({
    queryKey: ['photo', path, version],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path ?? '', 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

// ---------- Mutations ----------

export function useCreateKey(hid: string) {
  return useMutation({
    mutationFn: async (v: KeyFormOut) => {
      const { data, error } = await supabase
        .from('keys')
        .insert({ ...v, household_id: hid })
        .select('id')
        .single()
      if (error) throw error
      await syncHousehold(hid)
      return data.id
    },
  })
}

export function useUpdateKey(hid: string) {
  return useMutation({
    mutationFn: async ({
      id,
      ...v
    }: Partial<KeyFormOut> & { id: string; tag_id?: string | null }) => {
      const { error } = await supabase.from('keys').update(v).eq('id', id).eq('household_id', hid)
      if (error) throw error
      await syncHousehold(hid)
    },
  })
}

export function useDeleteKey(hid: string) {
  return useMutation({
    mutationFn: async (key: KeyRow) => {
      const { data, error } = await supabase
        .from('keys')
        .delete()
        .eq('id', key.id)
        .eq('household_id', hid)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new PermissionDeniedError()
      if (key.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([key.photo_path])
      await syncHousehold(hid)
    },
  })
}

export function photoPath(hid: string, keyId: string): string {
  return `${hid}/${keyId}.jpg`
}

/** Resize ≤1600px + re-encode (strips EXIF/GPS), upload to {hid}/{keyId}.jpg, link to key. */
export function useUploadPhoto(hid: string) {
  return useMutation({
    mutationFn: async ({ keyId, file }: { keyId: string; file: Blob }) => {
      const jpeg = await resizeToJpeg(file, 1600, 0.8)
      const path = photoPath(hid, keyId)
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' })
      if (upErr) throw upErr
      const { error } = await supabase
        .from('keys')
        .update({ photo_path: path })
        .eq('id', keyId)
        .eq('household_id', hid)
      if (error) throw error
      await syncHousehold(hid)
    },
  })
}

export function useRemovePhoto(hid: string) {
  return useMutation({
    mutationFn: async (key: KeyRow) => {
      const { error } = await supabase
        .from('keys')
        .update({ photo_path: null })
        .eq('id', key.id)
        .eq('household_id', hid)
      if (error) throw error
      if (key.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([key.photo_path])
      await syncHousehold(hid)
    },
  })
}

/** Keys that share this key's number (other copies), for "same number" hints. */
export function sameNumber(keys: readonly KeyRow[], keyNumber: string): KeyRow[] {
  const n = normalize(keyNumber)
  return keys.filter((k) => normalize(k.key_number) === n)
}
