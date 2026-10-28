import { env } from "cloudflare:workers";

import {
  buildEmailFeature,
  buildR2Feature,
  buildRequiredConfig,
} from "@/lib/env";
import { getDb } from "@/server/db";

import type { Context } from "./init";

export function createAppContext(locals: App.Locals): Context {
  return {
    db: getDb(env),
    config: buildRequiredConfig(env),
    email: buildEmailFeature(env),
    r2: buildR2Feature(env),
    queue: env.APP_QUEUE,
    user: locals.user
      ? {
          id: locals.user.id,
          email: locals.user.email,
          name: locals.user.name,
        }
      : null,
  };
}
