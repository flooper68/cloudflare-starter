import { env as workerEnv } from "cloudflare:workers";
import {
  type BillingProvider,
  type Notify,
  notify,
  type RequestContext,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";

import {
  buildEmailFeature,
  buildR2Feature,
  buildRequiredConfig,
} from "@/lib/env";
import {
  type BrowserExchange,
  createAdminAuthGateway,
} from "@/server/admin-auth-gateway";
import { getAuth } from "@/server/auth";
import { billingGateFor, billingProviderFor } from "@/server/billing-provider";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform, loggerFor, tracerFor } from "@/server/platform";

import type { Context, SessionInfo } from "./init";

/** What only a browser request has: its cookie session and its headers (impersonation). */
export interface BrowserContext {
  readonly session: SessionInfo | null;
  readonly exchange: BrowserExchange | null;
}

/**
 * The tRPC context for a signed-in (or anonymous) user. The web endpoint passes the
 * session user and the request context from Astro.locals; the MCP endpoint passes the user
 * of the access token. Same context, same procedures, same checks. `env` defaults to the
 * Worker's; API tests pass one with other vars (another WORKSPACE_MODE) and, for
 * BILLING=provider, a billing provider (the memory adapter). `browser` is the cookie
 * session and headers of a web request; MCP calls have none.
 */
export function createAppContext(
  user: Context["user"],
  requestContext: RequestContext,
  env: AppEnv = workerEnv as AppEnv,
  options: {
    readonly billingProvider?: BillingProvider;
    readonly browser?: BrowserContext;
  } = {}
): Context {
  const browser = options.browser ?? { session: null, exchange: null };
  const platform = buildPlatform(env);
  const scoped = {
    ...requestContext,
    userId: user?.id ?? null,
    // During an impersonation, events the user's actions record name the admin too.
    impersonatorUserId: browser.session?.impersonatedBy ?? null,
  };
  const notifier: Notify = (definition, input) =>
    notify(
      {
        jobQueue: platform.jobQueue,
        clock: systemClock,
        ids: randomIds,
        errors: platform.errors,
      },
      definition,
      input
    );
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
    notify: notifier,
    emailOut: platform.email,
    analytics: platform.productAnalytics(),
    user,
    session: browser.session,
    browser: browser.exchange,
    adminAuth: createAdminAuthGateway(() => getAuth(env), browser.exchange),
  };
}

/** The session fields procedures read, from Better Auth's session (Astro.locals.session). */
export function sessionOf(
  session: {
    readonly createdAt: Date | string;
    readonly impersonatedBy?: string | null;
  } | null
): SessionInfo | null {
  return session
    ? {
        createdAt: new Date(session.createdAt),
        impersonatedBy: session.impersonatedBy ?? null,
      }
    : null;
}

export function userOf(
  user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  } | null
): Context["user"] {
  // The platform role is read from D1 by adminProcedure, never from the session.
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}
