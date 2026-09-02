import { useUser } from '@clerk/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteSkeleton } from '@/layout/RouteSkeleton'

/** Sends a user to onboarding until they have finished it, and away after. */
export function TenantGate() {
  const { isLoaded, user } = useUser()
  const location = useLocation()

  if (!isLoaded) {
    return <RouteSkeleton />
  }

  const hasOnboarded = !!user?.publicMetadata?.onboarded

  if (hasOnboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  if (!hasOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
