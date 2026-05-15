import { useAuth } from '@clerk/react'
import { useLayoutEffect } from 'react'
import { setTokenGetter } from '@/lib/apiClient'

/**
 * Wires Clerk's getToken into apiClient via the setTokenGetter contract.
 * useLayoutEffect runs synchronously before children paint so the very first
 * request from a child component already has the token attached.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth()

  useLayoutEffect(() => {
    if (isLoaded) {
      setTokenGetter(getToken)
    }
    return () => setTokenGetter(null)
  }, [getToken, isLoaded])

  if (!isLoaded) return null

  return <>{children}</>
}
