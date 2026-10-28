import type { AppEnv } from "@/server/env";

export interface ScheduledHelloLog {
  readonly tag: "cron-hello";
  readonly message: "Hello from cron";
  readonly environment: string;
  readonly cron: string;
  readonly scheduledTime: string;
}

export function buildScheduledHelloLog(input: {
  readonly env: Pick<AppEnv, "APP_ENV">;
  readonly cron: string;
  readonly scheduledTime: number;
}): ScheduledHelloLog {
  return {
    tag: "cron-hello",
    message: "Hello from cron",
    environment: input.env.APP_ENV || "develop",
    cron: input.cron,
    scheduledTime: new Date(input.scheduledTime).toISOString(),
  };
}

/** Cron Triggers from `triggers.crons` in wrangler.jsonc. Branch on `controller.cron` for several schedules. */
export async function runScheduled(
  controller: ScheduledController,
  env: AppEnv
): Promise<void> {
  console.log(
    JSON.stringify(
      buildScheduledHelloLog({
        env,
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
    )
  );
}
