import { SignIn as ClerkSignIn } from '@clerk/react'

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ClerkSignIn />
    </div>
  )
}
