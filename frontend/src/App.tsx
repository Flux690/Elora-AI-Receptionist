import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import SignIn from '@/pages/SignIn'
import SSOCallback from '@/pages/SSOCallback'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { TenantGate } from '@/components/auth/TenantGate'
import AppLayout from '@/components/layout/AppLayout'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Settings = lazy(() => import('@/pages/Settings'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sso-callback" element={<SSOCallback />} />

      <Route element={
        <ProtectedRoute>
          <AuthProvider>
            <TenantGate />
          </AuthProvider>
        </ProtectedRoute>
      }>
        <Route path="/onboarding" element={<Suspense><Onboarding /></Suspense>} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Suspense><Dashboard tab="calls" /></Suspense>} />
          <Route path="/escalations" element={<Suspense><Dashboard tab="escalations" /></Suspense>} />
          <Route path="/appointments" element={<Suspense><Dashboard tab="appointments" /></Suspense>} />
          <Route path="/knowledge" element={<Suspense><Dashboard tab="knowledge" /></Suspense>} />
          <Route path="/settings" element={<Suspense><Settings /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  )
}
