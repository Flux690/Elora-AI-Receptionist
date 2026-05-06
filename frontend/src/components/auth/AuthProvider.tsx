import { useAuth } from '@clerk/react'
import { useLayoutEffect } from 'react'
import { setTokenGetter } from '@/lib/apiClient'

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
