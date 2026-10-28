import {
  type CronCatalog,
  type CronDeps,
  createRequestContext,
  cronCatalog,
  cronEntriesFor,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";

import { errorTypeOf, secondsSince } from "@/server/instrumentation";
import { loggerFor, type Platform, tracerFor } from "@/server/platform";

/**
 * Cron Triggers from `triggers.crons` in wrangler.jsonc. Runs every entry of the cron catalog
 * (packages/features/src/cron-catalog.ts) whose schedule is `controller.cron`, each with its
 * own request context (a new trace). Entries enqueue jobs; the queue does the work. A
 * failing entry is reported and the others still run; the run then rethrows so it shows as
 * failed in the Workers dashboard. A trigger with no entry is reported as a failure too.
 * Each entry's run is a span (`cron <name>`) and one measurement of
 * `app.cron.run.duration` by entry, schedule and error type; the run's metrics are
 * flushed when it ends.
 */
export async function runScheduled(
  controller: Pick<ScheduledController, "cron" | "scheduledTime">,
  platform: Platform,
  catalog: CronCatalog<CronDeps> = cronCatalog
): Promise<void> {
  try {
    await runEntries(controller, platform, catalog);
  } finally {
    platform.metrics.flush();
  }
}

async function runEntries(
  controller: Pick<ScheduledController, "cron" | "scheduledTime">,
  platform: Platform,
  catalog: CronCatalog<CronDeps>
): Promise<void> {
  const entries = cronEntriesFor(catalog, controller.cron);
  const failures: unknown[] = [];

  if (entries.length === 0) {
    const context = cronContext(platform);
    const error = new Error(
      `No cron catalog entry has the schedule "${controller.cron}"`
    );
    platform.errors.capture(error, context, {
      "app.cron.schedule": controller.cron,
    });
    platform.metrics.histogram("app.cron.run.duration").record(0, {
      "app.cron.schedule": controller.cron,
      "error.type": "missing_catalog_entry",
    });
    throw error;
  }

  for (const entry of entries) {
    const context = cronContext(platform);
    const fields = {
      "app.cron.name": entry.name,
      "app.cron.schedule": controller.cron,
      "app.cron.scheduled_time": new Date(
        controller.scheduledTime
      ).toISOString(),
    };
    const logger = loggerFor(platform, context).child(fields);
    const started = systemClock.now();
    let errorType: string | undefined;
    try {
      await tracerFor(platform, context).startContextSpan(
        `cron ${entry.name}`,
        { "app.cron.name": entry.name, "app.cron.schedule": controller.cron },
        () =>
          entry.run(
            {
              jobQueue: platform.jobQueue,
              clock: systemClock,
              ids: randomIds,
              logger,
            },
            { scheduledTime: controller.scheduledTime, context }
          )
      );
      logger.info("cron.completed");
    } catch (error) {
      errorType = errorTypeOf(error);
      platform.errors.capture(error, context, fields);
      failures.push(error);
    }
    platform.metrics
      .histogram("app.cron.run.duration")
      .record(secondsSince(systemClock, started), {
        "app.cron.name": entry.name,
        "app.cron.schedule": controller.cron,
        "error.type": errorType,
      });
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `${failures.length} cron entr${failures.length === 1 ? "y" : "ies"} failed for "${controller.cron}"`
    );
  }
}

function cronContext(platform: Platform) {
  return createRequestContext(
    { ids: randomIds },
    {
      source: "cron",
      release: platform.release,
      environment: platform.environment,
    }
  );
}
