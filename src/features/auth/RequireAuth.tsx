import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenSpinner } from '@/components/ui'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!session) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}
