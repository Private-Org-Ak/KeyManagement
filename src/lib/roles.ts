import type { MemberRole } from '@/types/models'

/**
 * Mirror of the role matrix in docs/SECURITY.md. COSMETIC ONLY — it decides which buttons
 * to show. Postgres RLS + RPCs are the protection (CLAUDE.md hard rule 1).
 */
export type Action =
  | 'edit'
  | 'delete'
  | 'rename'
  | 'invite-member'
  | 'invite-admin'
  | 'view-invites'
  | 'remove-member'
  | 'remove-admin'
  | 'leave'
  | 'delete-household'

const MATRIX: Record<Action, readonly MemberRole[]> = {
  edit: ['owner', 'admin', 'member'],
  delete: ['owner', 'admin'],
  rename: ['owner', 'admin'],
  'invite-member': ['owner', 'admin'],
  'invite-admin': ['owner'],
  'view-invites': ['owner', 'admin'],
  'remove-member': ['owner', 'admin'],
  'remove-admin': ['owner'],
  leave: ['admin', 'member'],
  'delete-household': ['owner'],
}

export function can(role: MemberRole | null | undefined, action: Action): boolean {
  return !!role && MATRIX[action].includes(role)
}

/** Can `actor` remove a member whose role is `target`? (owner can't be removed) */
export function canRemove(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  if (target === 'owner') return false
  return can(actor, target === 'admin' ? 'remove-admin' : 'remove-member')
}

export function invitableRoles(role: MemberRole | null | undefined): MemberRole[] {
  const out: MemberRole[] = []
  if (can(role, 'invite-member')) out.push('member')
  if (can(role, 'invite-admin')) out.push('admin')
  return out
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}
