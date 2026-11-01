import { z } from 'zod'

/**
 * Sign-in identifier: an email address or a phone number (D30). Phones are stored by
 * Supabase in E.164 without the "+", e.g. "919876543210".
 */
export type Identifier = { kind: 'email'; email: string } | { kind: 'phone'; phone: string }

/** Country code assumed for 10-digit numbers typed without one (the family is in India). */
export const DEFAULT_COUNTRY_CODE = '91'

/** Parses what the user typed into "Email or phone". Returns null when it is neither. */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim()
  if (value === '') return null
  if (value.includes('@')) {
    const email = value.toLowerCase()
    return email.length <= 254 && z.email().safeParse(email).success
      ? { kind: 'email', email }
      : null
  }
  const compact = value.replace(/[\s().-]/g, '')
  let digits: string
  if (/^\+\d+$/.test(compact)) digits = compact.slice(1)
  else if (/^00\d+$/.test(compact)) digits = compact.slice(2)
  else if (/^0?\d{10}$/.test(compact)) digits = DEFAULT_COUNTRY_CODE + compact.slice(-10)
  else return null
  if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null
  return { kind: 'phone', phone: `+${digits}` }
}

/** What to show for the signed-in account: the email, or the phone as "+<digits>". */
export function accountLabel(user: {
  email?: string | null
  phone?: string | null
}): string | null {
  if (user.email) return user.email
  if (user.phone) return user.phone.startsWith('+') ? user.phone : `+${user.phone}`
  return null
}
