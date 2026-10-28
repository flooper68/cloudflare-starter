import { HumanCheck, RateLimitNotice } from "@cloudflare-starter/ui";
import { useState } from "react";

/** What the page passes down: the Turnstile site key, or null when TURNSTILE=off. */
export type HumanCheckConfig = { readonly siteKey: string } | null;

/** Must match HUMAN_CHECK_HEADER in src/server/auth.ts. */
const HUMAN_CHECK_HEADER = "x-captcha-response";

/** Seconds from a 429's Retry-After header; a minute when it is missing or odd. */
export function retryAfterOf(response: Response): number {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

/**
 * Abuse protection for an auth form: the Turnstile token sent with the request, and the
 * wait after a 429. `fetchOptions` goes into the Better Auth client call; call `settle`
 * after every attempt, since a token is good for one request only.
 */
export function useAuthGuard(humanCheck: HumanCheckConfig) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  return {
    /** Submit stays disabled until the check passed and no wait is running. */
    ready: (!humanCheck || token !== null) && retryAfter === null,
    fetchOptions: {
      headers: token ? { [HUMAN_CHECK_HEADER]: token } : {},
      onError: ({ response }: { readonly response: Response }) => {
        if (response.status === 429) setRetryAfter(retryAfterOf(response));
      },
    },
    settle() {
      if (!humanCheck) return;
      setToken(null);
      setResetKey((key) => key + 1);
    },
    /** True when the last attempt was rate limited (show no other error then). */
    limited: retryAfter !== null,
    clearLimit: () => setRetryAfter(null),
    humanCheck,
    token,
    setToken,
    resetKey,
    retryAfter,
  };
}

/** The guard's UI: the human check, or the rate-limit notice after a 429. */
export function AuthGuardFields({
  guard,
  action,
  subject,
}: {
  readonly guard: ReturnType<typeof useAuthGuard>;
  readonly action: string;
  readonly subject: string;
}) {
  if (guard.retryAfter !== null) {
    return (
      <RateLimitNotice
        retryAfterSeconds={guard.retryAfter}
        subject={subject}
        onRetry={guard.clearLimit}
      />
    );
  }
  if (!guard.humanCheck) return null;
  return (
    <HumanCheck
      siteKey={guard.humanCheck.siteKey}
      action={action}
      onTokenChange={guard.setToken}
      resetKey={guard.resetKey}
    />
  );
}
