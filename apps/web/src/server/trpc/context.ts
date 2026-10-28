import { env as workerEnv } from "cloudflare:workers";
import {
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
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform, loggerFor, tracerFor } from "@/server/platform";

import type { Context } from "./init";

/**
 * The tRPC context for a signed-in (or anonymous) user. The web endpoint passes the
 * session user and the request context from Astro.locals; the MCP endpoint passes the user
 * of the access token. Same context, same procedures, same checks. `env` defaults to the
 * Worker's; API tests pass one with other vars (another WORKSPACE_MODE).
 */
export function createAppContext(
  user: Context["user"],
  requestContext: RequestContext,
  env: AppEnv = workerEnv as AppEnv
): Context {
  const platform = buildPlatform(env);
  const scoped = { ...requestContext, userId: user?.id ?? null };
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
    user,
  };
}

export function userOf(
  user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  } | null
): Context["user"] {
  return user ? { id: user.id, email: user.email, name: user.name } : null;
}
