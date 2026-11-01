import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { wipeAll } from '@/lib/db'
import type { Identifier } from '@/lib/identifier'
import { wipeLocal } from '@/lib/local'
import { supabase } from '@/lib/supabase'

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session)
  })
  return () => {
    data.subscription.unsubscribe()
  }
}

type Credentials = { id: Identifier; password: string }

function credentials({ id, password }: Credentials) {
  return id.kind === 'email' ? { email: id.email, password } : { phone: id.phone, password }
}

/** Email or phone + password (D30). No email or SMS is sent. */
export function useSignIn() {
  return useMutation({
    mutationFn: async (c: Credentials) => {
      const { error } = await supabase.auth.signInWithPassword(credentials(c))
      if (error) throw error
    },
  })
}

/**
 * Creates the account and signs in. Supabase must have "Confirm email" / "Confirm phone"
 * turned off; otherwise no session comes back and we say so (docs/DEPLOY.md).
 */
export function useSignUp() {
  return useMutation({
    mutationFn: async (c: Credentials) => {
      const { data, error } = await supabase.auth.signUp(credentials(c))
      if (error) throw error
      // With confirmations on, an existing address also comes back as a session-less user.
      if (!data.session)
        throw Object.assign(new Error('confirmation'), { code: 'confirmation_required' })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}

/** Signs out and wipes every cached household, thumbnail and local preference (rule 9). */
export async function signOutAndWipe(clearQueries: () => void): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } finally {
    clearQueries()
    await wipeAll()
    wipeLocal()
  }
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      signOutAndWipe(() => {
        qc.clear()
      }),
  })
}

/** Ask the browser to keep IndexedDB data (installed PWAs are usually granted). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = (navigator as { storage?: StorageManager }).storage
    if (storage) {
      if (await storage.persisted()) return true
      return await storage.persist()
    }
  } catch {
    // ignore
  }
  return false
}
