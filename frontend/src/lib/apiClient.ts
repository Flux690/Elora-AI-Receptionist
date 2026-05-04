import axios from 'axios'

type TokenGetter = () => Promise<string | null>

let _getToken: TokenGetter | null = null

export function setTokenGetter(getter: TokenGetter | null) {
  _getToken = getter
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
})

apiClient.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
