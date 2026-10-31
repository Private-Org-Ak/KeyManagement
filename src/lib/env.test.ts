import { describe, expect, it } from 'vitest'
import { EnvError, readEnv } from './env'

describe('readEnv', () => {
  const valid = {
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321/',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  }

  it('returns the normalized config when both vars are set', () => {
    expect(readEnv(valid)).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'anon-key',
    })
  })

  it.each([
    ['VITE_SUPABASE_URL', { VITE_SUPABASE_ANON_KEY: 'k' }],
    ['VITE_SUPABASE_ANON_KEY', { VITE_SUPABASE_URL: 'https://x.supabase.co' }],
    ['VITE_SUPABASE_URL', { ...valid, VITE_SUPABASE_URL: '   ' }],
  ])('throws a clear error when %s is missing', (name, source) => {
    expect(() => readEnv(source)).toThrow(EnvError)
    expect(() => readEnv(source)).toThrow(name)
  })

  it('rejects an invalid or non-http URL', () => {
    expect(() => readEnv({ ...valid, VITE_SUPABASE_URL: 'not a url' })).toThrow(EnvError)
    expect(() => readEnv({ ...valid, VITE_SUPABASE_URL: 'ftp://example.com' })).toThrow('http(s)')
  })

  it('resolves same-origin to the page origin (phone testing through the proxy)', () => {
    const source = { ...valid, VITE_SUPABASE_URL: 'same-origin' }
    expect(readEnv(source, 'https://abc.trycloudflare.com').supabaseUrl).toBe(
      'https://abc.trycloudflare.com',
    )
    expect(() => readEnv(source)).toThrow(EnvError)
  })
})
