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
