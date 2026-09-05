import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteSkeleton } from '@/layout/RouteSkeleton'
import { keys, fetchers } from '@/lib/queries'

/**
 * Sends a user to onboarding until they have a business, and away after.
 *
 * The answer comes from the API, which derives it from the agent row.
 *
 * Deliberately not Clerk's `publicMetadata.onboarded`: being onboarded is a fact
 * about the business, not the identity, and holding it in two places lets them
 * disagree. Any agent created outside this flow — a restored backup, a seeded
 * database — would leave the flag false and send its owner into onboarding on top
 * of a business that already exists, where the unique constraint on
 * `clerk_user_id` rejects the insert. PLAN.md 2.1 takes the same view.
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
