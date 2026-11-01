import { afterEach, describe, expect, it, vi } from 'vitest'
import { toAppError } from './errors'

describe('toAppError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [{ code: '42501', message: 'new row violates row-level security policy' }, 'permission'],
    [{ code: 'P0002' }, 'not-member'],
    [{ code: '28000' }, 'session'],
    [
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint "doors_household_id_name_key"',
      },
      'duplicate-door',
    ],
    [
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint "keys_household_tag_uidx"',
      },
      'duplicate-tag',
    ],
    [{ code: '23514' }, 'invalid'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rate-limit'],
    [new Error('boom'), 'unknown'],
    ['weird', 'unknown'],
    [null, 'unknown'],
  ])('%j → %s', (err, kind) => {
    expect(toAppError(err).kind).toBe(kind)
  })

  it('maps 22023 to the invite message only for accept_invite', () => {
    expect(toAppError({ code: '22023' }, 'accept_invite').message).toBe(
      'This invite is invalid, used or expired.',
    )
    expect(toAppError({ code: '22023' }).kind).toBe('invalid')
  })

  it('maps a wrong/expired OTP when verifying', () => {
    expect(toAppError({ code: 'invalid_credentials', status: 400 }).kind).toBe('bad-login')
    expect(toAppError({ status: 400 }, 'sign_in').kind).toBe('bad-login')
    expect(toAppError({ code: 'user_already_exists', status: 422 }).kind).toBe('account-exists')
    expect(toAppError({ code: 'weak_password', status: 422 }).kind).toBe('weak-password')
    expect(toAppError({ code: 'phone_provider_disabled' }).kind).toBe('auth-disabled')
    expect(toAppError({ code: 'confirmation_required' }).kind).toBe('auth-setup')
  })

  it('reports offline when the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(toAppError({ code: '42501' }).kind).toBe('offline')
  })

  it('does not call a server timeout "offline"', () => {
    const timeout = { name: 'AuthRetryableFetchError', status: 504, message: 'Gateway Timeout' }
    expect(toAppError(timeout).kind).toBe('server')
    expect(toAppError({ name: 'AuthApiError', status: 500 }, 'sign_in').kind).toBe('server')
    expect(toAppError({ name: 'AuthRetryableFetchError', status: 0 }).kind).toBe('offline')
  })

  it('maps fetch failures to offline', () => {
    expect(toAppError(new TypeError('Failed to fetch')).kind).toBe('offline')
  })

  it('never echoes the raw message', () => {
    const e = toAppError({ code: 'XX000', message: 'key KF-1021 secret detail' })
    expect(e.message).not.toContain('KF-1021')
  })
})
