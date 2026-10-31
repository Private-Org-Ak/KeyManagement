import type { CachedHousehold, KeyRow } from '@/types/models'
import { db, metaKeys, wipeHousehold, type KeyFinderDB } from './db'
import { resizeToJpeg } from './image'
import { wipeHouseholdLocal } from './local'
import { supabase } from './supabase'

export const PHOTO_BUCKET = 'key-photos'
const THUMB_MAX = 200

/**
 * Fetches the user's memberships and mirrors them into Dexie. Households the user is no
 * longer a member of are wiped from the device (rule 9). Returns the current list.
 */
export async function refreshMemberships(
  userId: string,
  database: KeyFinderDB = db,
): Promise<CachedHousehold[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('household_id, role, households(id, name)')
    .eq('user_id', userId)
  if (error) throw error

  const list: CachedHousehold[] = data.map((m) => ({
    id: m.households.id,
    name: m.households.name,
    role: m.role,
  }))
  const keep = new Set(list.map((h) => h.id))
  const cached = await database.households.toArray()
  for (const h of cached) {
    if (keep.has(h.id)) continue
    await wipeHousehold(h.id, database)
    wipeHouseholdLocal(h.id)
  }
  await database.households.bulkPut(list)
  await database.meta.put({ key: metaKeys.membershipsLoadedFor, value: userId })
  return list
}

/**
 * Full refresh of one household (tiny dataset): fetch all doors + keys and replace the
 * household's rows in a single transaction. Then refresh thumbnails in the background.
 */
export async function syncHousehold(hid: string, database: KeyFinderDB = db): Promise<void> {
  const [doorsRes, keysRes] = await Promise.all([
    supabase.from('doors').select('*').eq('household_id', hid),
    supabase.from('keys').select('*').eq('household_id', hid),
  ])
  if (doorsRes.error) throw doorsRes.error
  if (keysRes.error) throw keysRes.error
  const doors = doorsRes.data
  const keys = keysRes.data

  await database.transaction('rw', [database.doors, database.keys, database.meta], async () => {
    await database.doors.where('household_id').equals(hid).delete()
    await database.keys.where('household_id').equals(hid).delete()
    await database.doors.bulkAdd(doors)
    await database.keys.bulkAdd(keys)
    await database.meta.put({ key: metaKeys.lastSynced(hid), value: new Date().toISOString() })
  })

  void refreshThumbnails(hid, keys, database).catch(() => {
    // Thumbnails are best-effort; the next sync retries.
  })
}

/** Downloads missing/outdated key photos via signed URLs and stores ≤200px blobs. */
export async function refreshThumbnails(
  hid: string,
  keys: readonly KeyRow[],
  database: KeyFinderDB = db,
): Promise<void> {
  const withPhoto = keys.filter((k) => k.photo_path)
  const existing = await database.thumbs.where('household_id').equals(hid).toArray()
  const byKey = new Map(existing.map((t) => [t.key_id, t]))

  // Drop thumbs for deleted keys or removed photos.
  const wanted = new Set(withPhoto.map((k) => k.id))
  const stale = existing.filter((t) => !wanted.has(t.key_id)).map((t) => t.key_id)
  if (stale.length) await database.thumbs.bulkDelete(stale)

  const todo = withPhoto.filter((k) => byKey.get(k.id)?.version !== k.updated_at)
  if (todo.length === 0) return

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(
    todo.map((k) => k.photo_path ?? ''),
    60,
  )
  if (error) throw error

  for (const [i, key] of todo.entries()) {
    const signed = data[i]?.signedUrl
    if (!signed) continue
    try {
      const res = await fetch(signed, { cache: 'no-store' })
      if (!res.ok) continue
      const blob = await resizeToJpeg(await res.blob(), THUMB_MAX, 0.75)
      await database.thumbs.put({
        key_id: key.id,
        household_id: hid,
        version: key.updated_at,
        blob,
      })
    } catch {
      // Skip this one; retried on next sync.
    }
  }
}

export async function lastSyncedAt(
  hid: string,
  database: KeyFinderDB = db,
): Promise<string | null> {
  return (await database.meta.get(metaKeys.lastSynced(hid)))?.value ?? null
}
