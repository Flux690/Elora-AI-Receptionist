import { AuthenticateWithRedirectCallback } from "@clerk/react";
import { useSearchParams } from "react-router-dom";

export default function SSOCallback() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={returnTo}
      signUpForceRedirectUrl={returnTo}
    />
  );
}
