import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readEnv } from './env'

// Fails loudly at startup if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.
const env = readEnv(
  import.meta.env,
  typeof window === 'undefined' ? undefined : window.location.origin,
)

/**
 * The single Supabase client. Only the public anon key is used here.
 * Components must not import this directly — go through `src/features/*\/api.ts` hooks.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Login is an email OTP code typed into the app; there are no auth redirects to parse.
    detectSessionInUrl: false,
  },
})
