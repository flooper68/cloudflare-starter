import { z } from "zod";

import { defineEvent } from "../../kernel";

/** How an account was created. */
export const SIGN_UP_METHODS = ["password", "social", "other"] as const;

/** An account was created (Better Auth's user.create hook, apps/web/src/server/auth-audit.ts). */
export const signedUpEvent = defineEvent(
  "auth.signed_up",
  { strings: ["method", "provider"], numbers: [] },
  z
    .object({
      method: z.enum(SIGN_UP_METHODS),
      // The social sign-in provider ("google"), null for email + password.
      provider: z.string().max(32).nullable(),
    })
    .strict(),
  {
    client: false,
    description: "An account was created; how (password, social provider)",
  }
);

/** How a sign-up was attempted on the sign-up page. */
export const SIGN_UP_ATTEMPT_METHODS = ["password", "google"] as const;

/**
 * Someone submitted the sign-up page (a valid form, or the Google button), before an
 * account exists: sent anonymously by the page (`site: true`). With `auth.signed_up` and
 * `auth.sign_up_failed` it gives the sign-up step's drop-off.
 */
export const signUpStartedEvent = defineEvent(
  "auth.sign_up_started",
  { strings: ["method"], numbers: [] },
  z.object({ method: z.enum(SIGN_UP_ATTEMPT_METHODS) }).strict(),
  {
    client: false,
    site: true,
    description:
      "The sign-up form was submitted (password) or Google chosen, before an account exists",
  }
);

/** Why a sign-up attempt did not create an account, as the page saw it. */
export const SIGN_UP_FAILURE_REASONS = [
  "invalid",
  "bot_check",
  "exists",
  "not_allowed",
  "rate_limited",
  "error",
] as const;

/**
 * A sign-up attempt failed on the page: the form was invalid, the human check refused,
 * the address already had an account, sign-up was not open to it, too many attempts, or
 * another error. Sent anonymously by the page (`site: true`); never the address.
 */
export const signUpFailedEvent = defineEvent(
  "auth.sign_up_failed",
  { strings: ["reason"], numbers: [] },
  z.object({ reason: z.enum(SIGN_UP_FAILURE_REASONS) }).strict(),
  {
    client: false,
    site: true,
    description:
      "A sign-up attempt failed: invalid form, bot check, existing account, not allowed, rate limited, error",
  }
);
