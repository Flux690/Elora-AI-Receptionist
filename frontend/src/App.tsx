import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import AppLayout from '@/components/layout/AppLayout'
import SignIn from '@/pages/SignIn'
import Overview from '@/pages/Overview'
import Inbox from '@/pages/Inbox'
import Calls from '@/pages/Calls'
import Settings from '@/pages/Settings'

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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="calls" element={<Calls />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
