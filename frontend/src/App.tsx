import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import AppLayout from '@/components/layout/AppLayout'
import SignIn from '@/pages/SignIn'
import SSOCallback from '@/pages/SSOCallback'

const Overview = lazy(() => import('@/pages/Overview'))
const Inbox = lazy(() => import('@/pages/Inbox'))
const Calls = lazy(() => import('@/pages/Calls'))
const Appointments = lazy(() => import('@/pages/Appointments'))
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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Suspense><Overview /></Suspense>} />
        <Route path="inbox" element={<Suspense><Inbox /></Suspense>} />
        <Route path="calls" element={<Suspense><Calls /></Suspense>} />
        <Route path="appointments" element={<Suspense><Appointments /></Suspense>} />
        <Route path="settings" element={<Suspense><Settings /></Suspense>} />
      </Route>
    </Routes>
  )
}
