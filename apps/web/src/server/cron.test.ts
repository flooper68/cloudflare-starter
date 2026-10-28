import { describe, expect, it } from "vitest";

import { buildScheduledHelloLog } from "./cron";

describe("cron", () => {
  it("uses APP_ENV when present", () => {
    expect(
      buildScheduledHelloLog({
        env: { APP_ENV: "staging" },
        cron: "*/5 * * * *",
        scheduledTime: Date.parse("2026-04-20T12:00:00.000Z"),
      })
    ).toEqual({
      tag: "cron-hello",
      message: "Hello from cron",
      environment: "staging",
      cron: "*/5 * * * *",
      scheduledTime: "2026-04-20T12:00:00.000Z",
    });
  });

  it("falls back to develop when APP_ENV is absent", () => {
    expect(
      buildScheduledHelloLog({
        env: {},
        cron: "0 * * * *",
        scheduledTime: Date.parse("2026-04-20T13:00:00.000Z"),
      }).environment
    ).toBe("develop");
  });
});
