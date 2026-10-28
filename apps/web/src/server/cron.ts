import { scheduledGreeting } from "@cloudflare-starter/features";

import type { AppEnv } from "@/server/env";

/** Cron Triggers from `triggers.crons` in wrangler.jsonc. Branch on `controller.cron` for several schedules. */
export async function runScheduled(
  controller: ScheduledController,
  env: AppEnv
): Promise<void> {
  console.log(
    JSON.stringify(
      scheduledGreeting({
        environment: env.APP_ENV || "develop",
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
    )
  );
}
