/**
 * The automated QA suite's bypass of the human check, at the Better Auth edge
 * (QA_BYPASS=on). Called by `enforceHumanCheck` (server/auth.ts) for the human-checked
 * endpoints only, before Turnstile: a request with the right `x-qa-token` for an address in
 * QA_EMAIL_DOMAIN skips Turnstile and nothing else (Better Auth's limits, sign-up policy,
 * email verification and every later check still run). Security model:
 * docs/reference/abuse-protection.md#qa-bypass
 */
import {
  checkQaBypass,
  QA_TOKEN_HEADER,
  RateLimitedError,
} from "@cloudflare-starter/features";
import { APIError } from "better-auth/api";

import { auditQaBypassUsed, contextFor } from "@/server/auth-audit";
import type { AppEnv } from "@/server/env";
import { buildPlatform, loggerFor } from "@/server/platform";
import { RATE_LIMIT_POLICY_FIELD } from "@/server/rate-limited-response";

/** The email the request body names, untouched (isQaEmail trims and lowercases it). */
function requestEmail(ctx: { readonly body?: unknown }): string | null {
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email : null;
}

/**
 * Whether this request skips the human check. False (and nothing recorded) with
 * QA_BYPASS=off or without the header. A wrong token or a non-QA address logs
 * `qa.bypass.rejected` (a warning without the token) and falls back to Turnstile; over the
 * `qa.bypass` limit the request is refused with 429. An accepted bypass is recorded as
 * `qa.bypass.used`.
 */
export async function qaBypassesHumanCheck(
  env: AppEnv,
  ctx: {
    readonly headers?: Headers;
    readonly body?: unknown;
    readonly request?: Request;
  },
  form: "sign-up" | "sign-in" | "password-reset"
): Promise<boolean> {
  const platform = buildPlatform(env);
  if (!platform.qaBypass) return false;
  const presentedToken = ctx.headers?.get(QA_TOKEN_HEADER) ?? null;
  if (presentedToken === null) return false;
  const requestContext = contextFor(env, ctx);
  try {
    return await checkQaBypass(
      {
        rateLimiter: platform.rateLimiter,
        onAccepted: () => auditQaBypassUsed(env, ctx, form),
        onRejected: (reason) =>
          loggerFor(platform, requestContext).warn("qa.bypass.rejected", {
            "app.auth.human_check.form": form,
            "app.qa_bypass.reason": reason,
          }),
      },
      {
        bypass: platform.qaBypass,
        presentedToken,
        // The full address, as Better Auth will use it: never the audit log's shortened copy.
        email: requestEmail(ctx),
        ip: requestContext.ip,
      }
    );
  } catch (error) {
    if (error instanceof RateLimitedError) {
      throw new APIError(
        "TOO_MANY_REQUESTS",
        {
          code: error.code,
          message: error.message,
          [RATE_LIMIT_POLICY_FIELD]: error.policy,
        },
        { "x-retry-after": String(error.retryAfterSeconds) }
      );
    }
    throw error;
  }
}
