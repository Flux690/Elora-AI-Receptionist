import { AuthenticateWithRedirectCallback } from '@clerk/react'

export default function SSOCallbackPage() {
  const params = new URLSearchParams(window.location.search)
  const returnTo = params.get('returnTo') || '/'
  return <AuthenticateWithRedirectCallback signInForceRedirectUrl={returnTo} />
}
