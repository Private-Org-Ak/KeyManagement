import { z } from 'zod'
import { parseIdentifier, type Identifier } from '@/lib/identifier'

/** Mirrors Supabase: minimum 8 (config `minimum_password_length`); bcrypt uses ≤ 72 bytes. */
export const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Keep it under 72 characters.')

export const identifier = z.string().transform((v, ctx): Identifier => {
  const id = parseIdentifier(v)
  if (!id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter an email address or a phone number.',
    })
    return z.NEVER
  }
  return id
})

export const signInSchema = z.object({
  id: identifier,
  password: z.string().min(1, 'Enter your password.'),
})

export const signUpSchema = z
  .object({ id: identifier, password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: 'The passwords don’t match.',
    path: ['confirm'],
  })
