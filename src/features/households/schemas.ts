import { z } from 'zod'
import { isValidInviteCode } from '@/lib/inviteCode'

// Mirrors DB limits: households.name 1–80, memberships.display_name ≤ 60.
export const householdName = z
  .string()
  .trim()
  .min(1, 'Give your home a name.')
  .max(80, 'Keep it under 80 characters.')
export const displayName = z.string().trim().max(60, 'Keep it under 60 characters.')

export const createHouseholdSchema = z.object({ name: householdName, displayName })
export const joinSchema = z.object({
  code: z.string().refine(isValidInviteCode, 'Invite codes look like ABCD-1234-EF56-7890.'),
  displayName,
})
// No email restriction: sign-up doesn't verify addresses (D30), so the single-use, expiring
// code is the protection.
export const inviteSchema = z.object({ role: z.enum(['member', 'admin']) })
