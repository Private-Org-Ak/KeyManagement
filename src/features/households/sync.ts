import { useQuery } from '@tanstack/react-query'
import { refreshMemberships, syncHousehold } from '@/lib/sync'

export const syncKeys = {
  memberships: (userId: string) => ['memberships', userId] as const,
  household: (hid: string) => ['household', hid, 'sync'] as const,
}

/**
 * Keeps the user's membership list fresh (app open, focus, reconnect, and on demand —
 * e.g. on every navigation, so a removed member is bounced out on their next tap).
 */
export function useMembershipSync(userId: string) {
  return useQuery({
    queryKey: syncKeys.memberships(userId),
    queryFn: () => refreshMemberships(userId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  })
}

/**
 * Full-refresh sync of one household into Dexie. Mutations invalidate this key, so the
 * cache is refreshed after every change. Paused automatically while offline.
 */
export function useHouseholdSync(hid: string) {
  return useQuery({
    queryKey: syncKeys.household(hid),
    queryFn: async () => {
      await syncHousehold(hid)
      return Date.now()
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60_000,
    retry: 1,
  })
}
