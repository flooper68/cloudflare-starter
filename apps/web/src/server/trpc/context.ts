import { env } from "cloudflare:workers";
import {
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
import { buildPlatform, loggerFor } from "@/server/platform";

import type { Context } from "./init";

/**
 * The tRPC context for a signed-in (or anonymous) user. The web endpoint passes the
 * session user and the request context from Astro.locals; the MCP endpoint passes the user
 * of the access token. Same context, same procedures, same checks.
 */
export function createAppContext(
  user: Context["user"],
  requestContext: RequestContext
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
    queue: env.APP_QUEUE,
    requestContext: scoped,
    logger: loggerFor(platform, scoped),
    errors: platform.errors,
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
