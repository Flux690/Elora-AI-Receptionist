import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteSkeleton } from '@/layout/RouteSkeleton'
import { keys, fetchers } from '@/lib/queries'

/**
 * Onboarded is derived from the agent row rather than held on the identity, so
 * the two cannot disagree about a business that already exists.
 */
export function AgentGate() {
  const location = useLocation()
  const { data, isPending } = useQuery({
    queryKey: keys.session,
    queryFn: fetchers.session,
    // The gate blocks every route, so a wrong answer is worse than a slow one:
    // it is read once per session and not refetched behind the user.
    staleTime: Infinity,
  })

  if (isPending) {
    return <RouteSkeleton />
  }

  const onboarded = !!data?.onboarded

  if (onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
