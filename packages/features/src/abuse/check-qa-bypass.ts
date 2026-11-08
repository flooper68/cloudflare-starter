import type { RateLimiter } from "../platform";
import {
  isQaEmail,
  type QaBypassRejection,
  type QaBypassSettings,
  timingSafeEqual,
} from "./domain";
import { enforceRateLimit } from "./enforce-rate-limit";

/**
 * Whether a request to a human-checked endpoint may skip the human check because the
 * automated QA suite sent it (QA_BYPASS=on). Returns false, and changes nothing, when the
 * bypass is off or the request carries no QA token: the human check then runs as usual.
 *
 * A request that carries a token is counted against `qa.bypass` first (throws
 * RateLimitedError over the limit, so guessing the token is slow), then the token is
 * compared in constant time and the email must be in the QA domain. A wrong token or
 * domain calls `onRejected` (a warning, no token in it) and returns false: the caller falls
 * back to the human check. Only a full match calls `onAccepted` (the audit event) and
 * returns true.
 */
export async function checkQaBypass(
  deps: {
    readonly rateLimiter: RateLimiter;
    readonly onAccepted: () => Promise<void>;
    readonly onRejected: (reason: QaBypassRejection) => void | Promise<void>;
  },
  input: {
    /** The environment's bypass, or null with QA_BYPASS=off. */
    readonly bypass: QaBypassSettings | null;
    /** The `x-qa-token` header, or null when the request has none. */
    readonly presentedToken: string | null;
    /** The email the request names (sign-up, sign-in, password reset). */
    readonly email: string | null;
    readonly ip: string | null;
  }
): Promise<boolean> {
  if (!input.bypass || input.presentedToken === null) return false;
  await enforceRateLimit(deps, {
    policy: "qa.bypass",
    subject: { userId: null, ip: input.ip },
  });
  // Both checks always run, so the answer takes as long whichever one fails.
  const tokenMatches = timingSafeEqual(
    input.presentedToken,
    input.bypass.token
  );
  const domainMatches = isQaEmail(input.email, input.bypass.emailDomain);
  if (!tokenMatches) {
    await deps.onRejected("wrong_token");
    return false;
  }
  if (!domainMatches) {
    await deps.onRejected("wrong_domain");
    return false;
  }
  await deps.onAccepted();
  return true;
}
