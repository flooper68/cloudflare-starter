import {
  buildEmailFeature,
  buildR2Feature,
  buildRequiredConfig,
} from "@/lib/env";
import {
  type ClerkUserSnapshot,
  ensureUserFromClerk,
} from "@/server/auth/ensure-user";
import { getDb } from "@/server/db";

import type { Context } from "./init";

export async function createAppContext(locals: App.Locals): Promise<Context> {
  const config = buildRequiredConfig(locals.runtime?.env);
  const db = getDb(locals.runtime?.env, locals.runtime?.env?.HYPERDRIVE);
  const clerkUser = (await locals.currentUser()) as ClerkUserSnapshot | null;
  const appUser = clerkUser ? await ensureUserFromClerk(db, clerkUser) : null;

  return {
    db,
    config,
    email: buildEmailFeature(locals.runtime?.env),
    r2: buildR2Feature(locals.runtime?.env),
    queue: locals.runtime?.env?.APP_QUEUE,
    clerkUser,
    appUser,
  };
}
