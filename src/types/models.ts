import type { Database } from './database'

type PublicTables = Database['public']['Tables']

export type DoorRow = PublicTables['doors']['Row']
export type KeyRow = PublicTables['keys']['Row']
export type HouseholdRow = PublicTables['households']['Row']
export type MembershipRow = PublicTables['memberships']['Row']
export type InviteRow = PublicTables['invites']['Row']
export type MemberRole = Database['public']['Enums']['member_role']
export type DoorType = Database['public']['Enums']['door_type']

export const DOOR_TYPES: readonly DoorType[] = [
  'main',
  'room',
  'washroom',
  'balcony',
  'store',
  'other',
] as const

export const DOOR_TYPE_LABEL: Record<DoorType, string> = {
  main: 'Main door',
  room: 'Room',
  washroom: 'Washroom',
  balcony: 'Balcony',
  store: 'Store',
  other: 'Other',
}

/** A household as cached locally, with the current user's role in it. */
export interface CachedHousehold {
  id: string
  name: string
  role: MemberRole
}
