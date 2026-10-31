import { Navigate } from 'react-router'
import { Banner, FullScreenSpinner } from '@/components/ui'
import { getLastHousehold } from '@/lib/local'
import { useUserId } from '@/features/auth/AuthProvider'
import { useHouseholds, useMembershipsLoaded } from './api'
import { useMembershipSync } from './sync'

/** `/` → last-used household, else the first one, else onboarding. */
export function HomeRedirect() {
  const userId = useUserId()
  const sync = useMembershipSync(userId)
  const households = useHouseholds()
  const loaded = useMembershipsLoaded(userId)

  if (households === undefined || loaded === undefined) return <FullScreenSpinner />
  if (households.length === 0) {
    if (!loaded && sync.isPending) return <FullScreenSpinner />
    if (!loaded && sync.isError)
      return (
        <Banner tone="error">Couldn’t load your homes. Check your connection and try again.</Banner>
      )
    return <Navigate to="/onboarding" replace />
  }
  const last = getLastHousehold()
  const target = households.find((h) => h.id === last) ?? households[0]
  return <Navigate to={`/h/${target?.id ?? ''}/doors`} replace />
}
