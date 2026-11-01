import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { PermissionDeniedError } from '@/lib/errors'
import { db, metaKeys, wipeHousehold } from '@/lib/db'
import { wipeHouseholdLocal } from '@/lib/local'
import { cleanInviteCode } from '@/lib/inviteCode'
import { supabase } from '@/lib/supabase'
import { PHOTO_BUCKET, refreshMemberships, syncHousehold } from '@/lib/sync'
import type { CachedHousehold, MemberRole } from '@/types/models'

export const qk = {
  members: (hid: string) => ['household', hid, 'members'] as const,
  invites: (hid: string) => ['household', hid, 'invites'] as const,
}

// ---------------------------------------------------------------------------
// Reads (local cache)
// ---------------------------------------------------------------------------

/** Households the user belongs to (Dexie; works offline). undefined while loading. */
export function useHouseholds(): CachedHousehold[] | undefined {
  return useLiveQuery(
    async () => (await db.households.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
}

export function useHousehold(hid: string): CachedHousehold | null | undefined {
  return useLiveQuery(async () => (await db.households.get(hid)) ?? null, [hid])
}

/** True once memberships were fetched at least once for this user on this device. */
export function useMembershipsLoaded(userId: string): boolean | undefined {
  return useLiveQuery(
    async () => (await db.meta.get(metaKeys.membershipsLoadedFor))?.value === userId,
    [userId],
  )
}

// ---------------------------------------------------------------------------
// Members & invites (online only)
// ---------------------------------------------------------------------------

export interface Member {
  user_id: string
  role: MemberRole
  display_name: string | null
  created_at: string
}

export function useMembers(hid: string) {
  return useQuery({
    queryKey: qk.members(hid),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('user_id, role, display_name, created_at')
        .eq('household_id', hid)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export interface PendingInvite {
  id: string
  role: MemberRole
  email: string | null
  created_at: string
  expires_at: string
}

export function usePendingInvites(hid: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.invites(hid),
    enabled,
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, role, email, created_at, expires_at')
        .eq('household_id', hid)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations (RPCs — memberships/invites are never written directly; rule 5)
// ---------------------------------------------------------------------------

export function useCreateHousehold(userId: string) {
  return useMutation({
    mutationFn: async ({ name, displayName }: { name: string; displayName: string }) => {
      const { data, error } = await supabase.rpc('create_household', {
        p_name: name,
        p_display_name: displayName,
      })
      if (error) throw error
      await refreshMemberships(userId)
      await syncHousehold(data)
      return data
    },
  })
}

export function useAcceptInvite(userId: string) {
  return useMutation({
    mutationFn: async ({ code, displayName }: { code: string; displayName: string }) => {
      const { data, error } = await supabase.rpc('accept_invite', {
        p_code: cleanInviteCode(code),
        p_display_name: displayName,
      })
      if (error) throw error
      await refreshMemberships(userId)
      await syncHousehold(data)
      return data
    },
  })
}

export function useCreateInvite(hid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ role }: { role: MemberRole }) => {
      const { data, error } = await supabase.rpc('create_invite', {
        p_household_id: hid,
        p_role: role,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites(hid) }),
  })
}

export function useRevokeInvite(hid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from('invites').delete().eq('id', inviteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites(hid) }),
  })
}

export function useRemoveMember(hid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_member', {
        p_household_id: hid,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.members(hid) }),
  })
}

async function forgetHousehold(hid: string, userId: string): Promise<void> {
  await wipeHousehold(hid)
  wipeHouseholdLocal(hid)
  await refreshMemberships(userId)
}

export function useLeaveHousehold(hid: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_household', { p_household_id: hid })
      if (error) throw error
      await forgetHousehold(hid, userId)
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['household', hid] })
    },
  })
}

export function useRenameHousehold(hid: string, userId: string) {
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('households')
        .update({ name })
        .eq('id', hid)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new PermissionDeniedError()
      await refreshMemberships(userId)
    },
  })
}

export function useDeleteHousehold(hid: string, userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      // Storage objects are not removed by the Postgres cascade — delete the photos first.
      const bucket = supabase.storage.from(PHOTO_BUCKET)
      const { data: files } = await bucket.list(hid, { limit: 1000 })
      if (files && files.length > 0) await bucket.remove(files.map((f) => `${hid}/${f.name}`))

      const { data, error } = await supabase.from('households').delete().eq('id', hid).select('id')
      if (error) throw error
      if (data.length === 0) throw new PermissionDeniedError()
      await forgetHousehold(hid, userId)
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['household', hid] })
    },
  })
}
