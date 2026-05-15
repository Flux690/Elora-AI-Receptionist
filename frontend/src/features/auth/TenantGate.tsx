import { useUser } from '@clerk/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Routes the user to /onboarding if they haven't onboarded, or away from it
 * if they have. Shows a minimal skeleton while Clerk loads.
 */
export function TenantGate() {
  const { isLoaded, user } = useUser()
  const location = useLocation()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="size-10 rounded-full" />
      </div>
    )
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
