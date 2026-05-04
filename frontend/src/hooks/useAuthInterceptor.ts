import { useAuth } from '@clerk/react'
import { useEffect } from 'react'
import { setTokenGetter } from '@/lib/apiClient'

export function useAuthInterceptor() {
  const { getToken } = useAuth()

  useEffect(() => {
    setTokenGetter(getToken)
    return () => setTokenGetter(null)
  }, [getToken])
}
