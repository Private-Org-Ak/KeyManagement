/**
 * Maps Postgres / RPC / network errors to human-readable messages
 * (docs/SECURITY.md#error-mapping). Raw messages are never shown: they can contain data.
 */
export type ErrorKind =
  | 'permission'
  | 'invite'
  | 'bad-code'
  | 'duplicate-door'
  | 'duplicate-tag'
  | 'duplicate'
  | 'not-member'
  | 'session'
  | 'offline'
  | 'rate-limit'
  | 'invalid'
  | 'unknown'

export interface AppError {
  kind: ErrorKind
  message: string
}

const MESSAGES: Record<ErrorKind, string> = {
  permission: "You don't have permission to do that.",
  invite: 'This invite is invalid, used or expired.',
  'bad-code': 'That code is wrong or has expired. Check the latest email or send a new code.',
  'duplicate-door': 'A door with that name already exists.',
  'duplicate-tag': 'That tag is already assigned to another key.',
  duplicate: 'That already exists.',
  'not-member': 'That person is no longer a member.',
  session: 'Your session has expired. Please sign in again.',
  offline: "You're offline. Lookups still work; changes need a connection.",
  'rate-limit': 'Too many attempts. Please wait a moment and try again.',
  invalid: 'Please check what you entered and try again.',
  unknown: 'Something went wrong. Please try again.',
}

function field(e: unknown, name: string): string | undefined {
  if (typeof e === 'object' && e !== null && name in e) {
    const v = (e as Record<string, unknown>)[name]
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined
  }
  return undefined
}

/** Thrown when a write affected 0 rows because RLS filtered it out. */
export class PermissionDeniedError extends Error {
  readonly code = '42501'
  override name = 'PermissionDeniedError'
}

export type ErrorContext = 'accept_invite' | 'verify_otp'

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export function toAppError(e: unknown, context?: ErrorContext): AppError {
  const make = (kind: ErrorKind): AppError => ({ kind, message: MESSAGES[kind] })
  const code = field(e, 'code')
  const status = field(e, 'status')
  const name = field(e, 'name')
  const details = `${field(e, 'message') ?? ''} ${field(e, 'details') ?? ''}`

  if (isOffline()) return make('offline')
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return make('offline')
  if (name === 'AuthRetryableFetchError') return make('offline')

  if (
    context === 'verify_otp' &&
    (code === 'otp_expired' || code === 'invalid_otp' || status === '403')
  )
    return make('bad-code')

  switch (code) {
    case '42501':
      return make('permission')
    case '22023':
      return make(context === 'accept_invite' ? 'invite' : 'invalid')
    case 'P0002':
      return make('not-member')
    case '28000':
    case 'PGRST301':
    case 'PGRST303':
      return make('session')
    case '23505':
      if (/doors_household_id_name_key/.test(details)) return make('duplicate-door')
      if (/keys_household_tag_uidx/.test(details)) return make('duplicate-tag')
      return make('duplicate')
    case '23514':
    case '22001':
    case '23502':
      return make('invalid')
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return make('rate-limit')
  }
  if (status === '429') return make('rate-limit')
  if (status === '401' || status === '403') return make(code ? 'permission' : 'session')
  return make('unknown')
}

export function errorMessage(e: unknown, context?: ErrorContext): string {
  return toAppError(e, context).message
}
