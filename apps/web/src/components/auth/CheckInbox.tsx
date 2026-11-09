import {
  CheckInboxCard,
  hydrationGated,
  type ResendResult,
} from "@cloudflare-starter/ui";

import { authClient, authErrorMessage } from "@/lib/auth-client";
import { verifiedCallbackURL } from "@/lib/auth-links";
import { retryAfterOf } from "./use-auth-guard";

/**
 * Sends the verification link again to the address just signed up with, or to the
 * signed-in user's own address: no typed-in address, so no human check; the server
 * limits it per IP (`auth.verification-email`). A 429 comes back as a wait.
 */
export async function resendVerification(
  email: string,
  next: string | null
): Promise<ResendResult> {
  let retryAfter: number | null = null;
  const { error } = await authClient.sendVerificationEmail({
    email,
    callbackURL: verifiedCallbackURL(next),
    fetchOptions: {
      onError: ({ response }) => {
        if (response.status === 429) retryAfter = retryAfterOf(response);
      },
    },
  });
  if (retryAfter !== null)
    return { status: "rate-limited", retryAfterSeconds: retryAfter };
  if (error) throw new Error(authErrorMessage(error, "Couldn't send the link"));
  return { status: "sent" };
}

/**
 * `/verify-email` for a signed-in user whose address is not verified yet (the dashboard's
 * checklist links here): resend, or change the address in the account settings.
 */
function CheckInboxView({
  email,
  next,
}: {
  readonly email: string;
  readonly next: string | null;
}) {
  return (
    <CheckInboxCard
      email={email}
      onResend={() => resendVerification(email, next)}
      useAnotherEmailHref="/app/settings/account"
    />
  );
}

/** The `client:load` island: its buttons wait for hydration (HydrationGate). */
export const CheckInbox = hydrationGated(CheckInboxView);
