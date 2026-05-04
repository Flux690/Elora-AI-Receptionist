import { useAuth } from '@clerk/react'
import { useEffect } from 'react'
import { apiClient } from '@/lib/apiClient'

export function useAuthInterceptor() {
  const { getToken } = useAuth()

  useEffect(() => {
    const id = apiClient.interceptors.request.use(async (config) => {
      const token = await getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    return () => apiClient.interceptors.request.eject(id)
  }, [getToken])
}
