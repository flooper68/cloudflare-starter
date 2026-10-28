import {
  createMemoryErrorReporter,
  createMemoryLogger,
} from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import { runScheduled } from "./cron";

describe("cron handler", () => {
  it("logs each run under its own request context", async () => {
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

    await runScheduled(controller, platform);
    await runScheduled(controller, platform);

    expect(logger.records).toHaveLength(2);
    expect(logger.records[0]).toMatchObject({
      level: "info",
      event: "cron.hello",
      source: "cron",
      environment: "staging",
      release: "v-test",
      cron: "*/5 * * * *",
      scheduledTime: "2026-10-28T12:00:00.000Z",
    });
    expect(logger.records[0]?.requestId).not.toBe(logger.records[1]?.requestId);
  });
});
