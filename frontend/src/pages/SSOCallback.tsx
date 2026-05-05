import { AuthenticateWithRedirectCallback } from '@clerk/react'

export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/appointments"
      signUpFallbackRedirectUrl="/appointments"
    />
  )
}
