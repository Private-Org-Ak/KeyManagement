import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { accountLabel } from '@/lib/identifier'
import { getSession, onAuthChange, requestPersistentStorage } from './api'

interface AuthState {
  session: Session | null
  userId: string | null
  /** Email, or phone as +<digits>, of the signed-in account. */
  account: string | null
  loading: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getSession().then((s) => {
      if (!active) return
      setSession(s)
      setLoading(false)
    })
    const unsubscribe = onAuthChange((s) => {
      setSession(s)
      setLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) void requestPersistentStorage()
  }, [session])

  const value: AuthState = {
    session,
    userId: session?.user.id ?? null,
    account: session ? accountLabel(session.user) : null,
    loading,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For routes behind RequireAuth: the user id is always present. */
export function useUserId(): string {
  const { userId } = useAuth()
  if (!userId) throw new Error('useUserId used outside an authenticated route')
  return userId
}
