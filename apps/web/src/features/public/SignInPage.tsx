import { SignIn } from '@clerk/react'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn fallbackRedirectUrl="/" />
    </div>
  )
}
