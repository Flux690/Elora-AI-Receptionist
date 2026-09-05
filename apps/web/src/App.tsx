import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { ErrorBoundary } from 'react-error-boundary'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AgentGate } from '@/features/auth/AgentGate'
import AppLayout from '@/layout/AppLayout'
import { RouteSkeleton } from '@/layout/RouteSkeleton'
import { ErrorFallback } from '@/layout/ErrorFallback'
import { NotFound } from '@/layout/NotFound'

const SignIn = lazy(() => import('@/features/public/SignInPage'))
const SSOCallback = lazy(() => import('@/features/public/SSOCallbackPage'))
const Home = lazy(() => import('@/features/home/HomePage'))
const CallDetail = lazy(() => import('@/features/calls/CallDetailPage'))
const Escalations = lazy(() => import('@/features/escalations/EscalationsPage'))
const Queue = lazy(() => import('@/features/escalations/QueuePage'))
const Appointments = lazy(() => import('@/features/appointments/AppointmentsPage'))
const Knowledge = lazy(() => import('@/features/knowledge/KnowledgePage'))
const Onboarding = lazy(() => import('@/features/onboarding/OnboardingPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  if (!isLoaded) return <RouteSkeleton />
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Routes>
        <Route
          path="/sign-in"
          element={
            <Suspense fallback={<RouteSkeleton />}>
              <SignIn />
            </Suspense>
          }
        />
        <Route
          path="/sso-callback"
          element={
            <Suspense fallback={<RouteSkeleton />}>
              <SSOCallback />
            </Suspense>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AuthProvider>
                <AgentGate />
              </AuthProvider>
            </ProtectedRoute>
          }
        >
          <Route
            path="/onboarding"
            element={
              <Suspense fallback={<RouteSkeleton />}>
                <Onboarding />
              </Suspense>
            }
          />

          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/calls/:id" element={<CallDetail />} />
            <Route path="/escalations" element={<Escalations />} />
            <Route path="/escalations/queue" element={<Queue />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
