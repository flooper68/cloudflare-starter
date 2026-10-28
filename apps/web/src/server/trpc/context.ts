import { env } from "cloudflare:workers";

import {
  buildEmailFeature,
  buildR2Feature,
  buildRequiredConfig,
} from "@/lib/env";
import { getDb } from "@/server/db";

import type { Context } from "./init";

/**
 * The tRPC context for a signed-in (or anonymous) user. The web endpoint passes the
 * session user from Astro.locals; the MCP endpoint passes the user of the access
 * token. Same context, same procedures, same checks.
 */
export function createAppContext(user: Context["user"]): Context {
  return {
    db: getDb(env),
    config: buildRequiredConfig(env),
    email: buildEmailFeature(env),
    r2: buildR2Feature(env),
    queue: env.APP_QUEUE,
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
