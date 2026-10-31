import { describe, expect, it } from 'vitest'
import { can, canRemove, invitableRoles } from './roles'

describe('role matrix (cosmetic mirror of SECURITY.md)', () => {
  it('members can edit but not delete, invite or rename', () => {
    expect(can('member', 'edit')).toBe(true)
    expect(can('member', 'delete')).toBe(false)
    expect(can('member', 'invite-member')).toBe(false)
    expect(can('member', 'rename')).toBe(false)
    expect(can('member', 'leave')).toBe(true)
  })
  it('admins can manage members but not admins', () => {
    expect(can('admin', 'delete')).toBe(true)
    expect(invitableRoles('admin')).toEqual(['member'])
    expect(canRemove('admin', 'member')).toBe(true)
    expect(canRemove('admin', 'admin')).toBe(false)
    expect(can('admin', 'delete-household')).toBe(false)
  })
  it('owners can do everything except leave', () => {
    expect(invitableRoles('owner')).toEqual(['member', 'admin'])
    expect(canRemove('owner', 'admin')).toBe(true)
    expect(canRemove('owner', 'owner')).toBe(false)
    expect(can('owner', 'leave')).toBe(false)
    expect(can('owner', 'delete-household')).toBe(true)
  })
  it('no role means nothing', () => {
    expect(can(null, 'edit')).toBe(false)
    expect(invitableRoles(undefined)).toEqual([])
  })
})
