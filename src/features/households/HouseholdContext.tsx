import { createContext, useContext } from 'react'
import type { CachedHousehold } from '@/types/models'

export interface HouseholdCtx {
  hid: string
  household: CachedHousehold
  /** Online — writes need a connection (offline is read-only, D8). */
  online: boolean
}

export const HouseholdContext = createContext<HouseholdCtx | null>(null)

export function useCurrentHousehold(): HouseholdCtx {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useCurrentHousehold must be used under /h/:hid')
  return ctx
}
