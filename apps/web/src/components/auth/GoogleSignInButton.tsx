import { Button } from "@cloudflare-starter/ui";
import { useState } from "react";

import { authClient, authErrorMessage } from "@/lib/auth-client";

export function GoogleSignInButton({
  onError,
}: {
  readonly onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app/dashboard",
      errorCallbackURL: "/sign-in",
    });
    // On success the browser is already navigating to Google.
    if (error) {
      onError(authErrorMessage(error, "Unable to start Google sign-in."));
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={() => void handleClick()}
      type="button"
      variant="outline"
    >
      {loading ? "Redirecting..." : "Continue with Google"}
    </Button>
  );
}
