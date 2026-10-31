import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router'
import { Banner, FullScreenSpinner } from '@/components/ui'
import { setLastHousehold } from '@/lib/local'
import { useOnline } from '@/lib/online'
import { useUserId } from '@/features/auth/AuthProvider'
import { useHousehold, useMembershipsLoaded } from './api'
import { HouseholdContext } from './HouseholdContext'
import { useHouseholdSync, useMembershipSync } from './sync'

/**
 * Guard + data owner for /h/:hid. Membership is re-checked on every navigation; if the
 * user is no longer a member the household is wiped locally (in refreshMemberships)
 * and they are sent to `/`.
 */
export function HouseholdLayout() {
  const { hid = '' } = useParams()
  const userId = useUserId()
  const location = useLocation()
  const online = useOnline()
  const memberships = useMembershipSync(userId)
  const loaded = useMembershipsLoaded(userId)
  const household = useHousehold(hid)
  const { refetch } = memberships

  useEffect(() => {
    void refetch()
  }, [location.key, refetch])

  useEffect(() => {
    if (household) setLastHousehold(household.id)
  }, [household])

  if (household === undefined || loaded === undefined) return <FullScreenSpinner />
  if (!household) {
    if (loaded || memberships.isSuccess) return <Navigate to="/" replace />
    if (memberships.isError || !online)
      return (
        <Banner tone="error">Couldn’t load your homes. Check your connection and try again.</Banner>
      )
    return <FullScreenSpinner />
  }

  return (
    <HouseholdContext.Provider value={{ hid, household, online }}>
      <HouseholdSync hid={hid} />
      {!online && (
        <Banner tone="warning" className="mb-4">
          You’re offline. Lookups still work; changes need a connection.
        </Banner>
      )}
      <Outlet />
    </HouseholdContext.Provider>
  )
}

function HouseholdSync({ hid }: { hid: string }) {
  useHouseholdSync(hid)
  return null
}
