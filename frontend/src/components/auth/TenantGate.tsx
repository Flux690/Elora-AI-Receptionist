import { useUser } from '@clerk/react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export function TenantGate() {
  const { isLoaded, user } = useUser()
  const location = useLocation()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasOnboarded = !!user?.publicMetadata?.onboarded

  // Route Guards
  if (hasOnboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }

  if (!hasOnboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
