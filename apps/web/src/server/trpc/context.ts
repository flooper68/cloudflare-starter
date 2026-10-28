import { env as workerEnv } from "cloudflare:workers";
import {
  type BillingProvider,
  type RequestContext,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";

import {
  buildEmailFeature,
  buildR2Feature,
  buildRequiredConfig,
} from "@/lib/env";
import { billingGateFor, billingProviderFor } from "@/server/billing-provider";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform, loggerFor, tracerFor } from "@/server/platform";

import type { Context } from "./init";

/**
 * The tRPC context for a signed-in (or anonymous) user. The web endpoint passes the
 * session user and the request context from Astro.locals; the MCP endpoint passes the user
 * of the access token. Same context, same procedures, same checks. `env` defaults to the
 * Worker's; API tests pass one with other vars (another WORKSPACE_MODE) and, for
 * BILLING=provider, a billing provider (the memory adapter).
 */
export function createAppContext(
  user: Context["user"],
  requestContext: RequestContext,
  env: AppEnv = workerEnv as AppEnv,
  options: { readonly billingProvider?: BillingProvider } = {}
): Context {
  const platform = buildPlatform(env);
  const scoped = { ...requestContext, userId: user?.id ?? null };
  return {
    db: getDb(env),
    clock: systemClock,
    ids: randomIds,
    config: buildRequiredConfig(env),
    email: buildEmailFeature(env),
    r2: buildR2Feature(env),
    bucket: env.FILES,
    jobQueue: platform.jobQueue,
    billing: billingGateFor(env, scoped),
    billingProvider: options.billingProvider ?? billingProviderFor(env),
    requestContext: scoped,
    logger: loggerFor(platform, scoped),
    errors: platform.errors,
    tracer: tracerFor(platform, scoped),
    metrics: platform.metrics,
    flags: platform.flags,
    flagStore: platform.flagStore,
    rateLimiter: platform.rateLimiter,
    analytics: platform.productAnalytics(),
    user,
  };
}

export function userOf(
  user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly role?: unknown;
  } | null
): Context["user"] {
  if (!user) return null;
  // The admin portal adds `role` to the user table; until then it is absent.
  const role = typeof user.role === "string" ? user.role : null;
  return { id: user.id, email: user.email, name: user.name, role };
}
