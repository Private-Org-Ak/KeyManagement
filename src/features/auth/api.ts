import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { wipeAll } from '@/lib/db'
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

/** Sends a 6-digit code. Creates the account on first use (no passwords). */
export function useSendCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      })
      if (error) throw error
    },
  })
}

export function useVerifyCode() {
  return useMutation({
    mutationFn: async ({ email, token }: { email: string; token: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw error
      return data.session
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
