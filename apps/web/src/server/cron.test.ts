import {
  createMemoryErrorReporter,
  createMemoryLogger,
  type Database,
} from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import { runScheduled } from "./cron";

describe("cron handler", () => {
  it("logs each run under its own trace", async () => {
    const logger = createMemoryLogger();
    const platform = {
      logger,
      errors: createMemoryErrorReporter(),
      release: "v-test",
      environment: "staging",
    };
    const controller = {
      cron: "*/5 * * * *",
      scheduledTime: Date.parse("2026-10-28T12:00:00.000Z"),
    } as ScheduledController;

    // The greeting schedule never touches the database; the audit purge is an API test.
    const deps = { db: {} as Database };
    await runScheduled(controller, platform, deps);
    await runScheduled(controller, platform, deps);

    expect(logger.records).toHaveLength(2);
    expect(logger.records[0]).toMatchObject({
      severity_text: "INFO",
      body: "cron.hello",
      attributes: {
        "app.request.source": "cron",
        "app.cron.schedule": "*/5 * * * *",
        "app.cron.scheduled_time": "2026-10-28T12:00:00.000Z",
      },
    });
    expect(logger.records[0]?.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(logger.records[0]?.trace_id).not.toBe(logger.records[1]?.trace_id);
  });
});
