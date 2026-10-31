/**
 * Client environment. Only public `VITE_` values belong here (CLAUDE.md hard rule 2):
 * the anon/publishable key is designed to be public; authorization lives in Postgres RLS.
 */
export interface ClientEnv {
  supabaseUrl: string
  supabaseAnonKey: string
}

export class EnvError extends Error {
  override name = 'EnvError'
}

type EnvSource = Partial<Record<string, string | boolean | undefined>>

function required(source: EnvSource, name: string): string {
  const value = source[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EnvError(
      `Missing ${name}. Copy .env.example to .env.local and fill it in ` +
        '(values come from `npx supabase status`).',
    )
  }
  return value.trim()
}

/**
 * `VITE_SUPABASE_URL=same-origin` (phone testing, `npm run phone`): the app talks to Supabase
 * through the preview server's proxy on the page's own origin, so a phone only needs to reach
 * one HTTPS address.
 */
export const SAME_ORIGIN = 'same-origin'

export function readEnv(source: EnvSource, pageOrigin?: string): ClientEnv {
  const configured = required(source, 'VITE_SUPABASE_URL')
  const supabaseAnonKey = required(source, 'VITE_SUPABASE_ANON_KEY')
  let supabaseUrl = configured
  if (configured === SAME_ORIGIN) {
    if (!pageOrigin) throw new EnvError('VITE_SUPABASE_URL=same-origin needs a page origin.')
    supabaseUrl = pageOrigin
  }

  let parsed: URL
  try {
    parsed = new URL(supabaseUrl)
  } catch {
    throw new EnvError('VITE_SUPABASE_URL is not a valid URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EnvError('VITE_SUPABASE_URL must be an http(s) URL.')
  }

  return { supabaseUrl: parsed.origin, supabaseAnonKey }
}
