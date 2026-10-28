import {
  createRequestContext,
  type Database,
  purgeAuditEvents,
  randomIds,
  scheduledGreeting,
} from "@cloudflare-starter/features";

import { loggerFor, type Platform } from "@/server/platform";

/** Daily at 03:17 UTC: delete audit events past retention (AUDIT_RETENTION_DAYS). */
export const AUDIT_PURGE_CRON = "17 3 * * *";

/**
 * Cron Triggers from `triggers.crons` in wrangler.jsonc. Each run gets its own request
 * context; branch on `controller.cron` for several schedules. A failure is reported and
 * rethrown, so the run shows as failed in the Workers dashboard.
 */
export async function runScheduled(
  controller: ScheduledController,
  platform: Platform,
  deps: { readonly db: Database }
): Promise<void> {
  const context = createRequestContext(
    { ids: randomIds },
    {
      source: "cron",
      release: platform.release,
      environment: platform.environment,
    }
  );
  try {
    if (controller.cron === AUDIT_PURGE_CRON) {
      const clock = { now: () => new Date(controller.scheduledTime) };
      const result = await purgeAuditEvents({ db: deps.db, clock });
      loggerFor(platform, context).info("cron.audit_purge", {
        "app.cron.schedule": controller.cron,
        "app.audit.deleted": result.deleted,
        "app.audit.cutoff": result.cutoff,
      });
      return;
    }
    loggerFor(platform, context).info(
      "cron.hello",
      scheduledGreeting({
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
    );
  } catch (error) {
    platform.errors.capture(error, context, {
      "app.cron.schedule": controller.cron,
    });
    throw error;
  }
}
