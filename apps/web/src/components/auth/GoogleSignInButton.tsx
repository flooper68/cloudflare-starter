import { Button } from "@cloudflare-starter/ui";
import { useState } from "react";

import { authClient, authErrorMessage, nextPath } from "@/lib/auth-client";

export function GoogleSignInButton({
  onError,
  onStart,
  search = "",
}: {
  readonly onError: (message: string) => void;
  /** Called when the person chooses Google, before leaving for it (the sign-up funnel). */
  readonly onStart?: () => void;
  /** The page query: `?next=` is where to land after signing in. */
  readonly search?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    onStart?.();
    setLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: nextPath(search) ?? "/app/dashboard",
      // A refused sign-up (invite-only) comes back as /sign-in?error=SIGN_UP_INVITE_ONLY.
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
