/**
 * The funnel's return step: when a signed-in person opens the app (/app, a full page load)
 * on a later UTC day than they signed up on, `app.session_returned` is sent once, with the
 * days since sign-up (recordReturnVisit). Visits on the sign-up day cost nothing; later
 * ones one no-op insert per isolate at most. Never fails the page.
 */
import { recordReturnVisit, systemClock } from "@cloudflare-starter/features";

import { productAnalyticsFor } from "@/server/analytics-audience";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";

export async function recordReturnOf(
  env: AppEnv,
  locals: Pick<App.Locals, "user" | "session" | "requestContext">
): Promise<void> {
  const { user, session } = locals;
  if (!user?.createdAt) return;
  const platform = buildPlatform(env);
  const context = { ...locals.requestContext, userId: user.id };
  await recordReturnVisit(
    {
      db: getDb(env),
      clock: systemClock,
      analytics: productAnalyticsFor(env, {
        email: user.email,
        impersonated: Boolean(session?.impersonatedBy),
      }),
      logger: platform.logger.withContext(context),
    },
    context,
    new Date(user.createdAt)
  );
}
