import {
  createRequestContext,
  randomIds,
  scheduledGreeting,
} from "@cloudflare-starter/features";

import { loggerFor, type Platform } from "@/server/platform";

/**
 * Cron Triggers from `triggers.crons` in wrangler.jsonc. Each run gets its own request
 * context; branch on `controller.cron` for several schedules. A failure is reported and
 * rethrown, so the run shows as failed in the Workers dashboard.
 */
export async function runScheduled(
  controller: ScheduledController,
  platform: Platform
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
    loggerFor(platform, context).info(
      "cron.hello",
      scheduledGreeting({
        environment: platform.environment,
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
    );
  } catch (error) {
    platform.errors.capture(error, context, { cron: controller.cron });
    throw error;
  }
}
