import { describe, expect, it } from "vitest";

import { helloGreeting } from "./greeting-log";
import { scheduledGreeting } from "./scheduled-greeting";

describe("greetings", () => {
  it("describes a consumed hello message as app.* attributes", () => {
    expect(
      helloGreeting({
        type: "hello",
        name: "Nicole",
        userId: "u1",
        queuedAt: "2026-04-20T12:00:00.000Z",
      })
    ).toEqual({
      "app.greeting.message": "Hello, Nicole",
      "app.greeting.queued_at": "2026-04-20T12:00:00.000Z",
    });
  });

  it("describes a cron run as app.* attributes", () => {
    expect(
      scheduledGreeting({
        cron: "*/5 * * * *",
        scheduledTime: Date.parse("2026-04-20T12:00:00.000Z"),
      })
    ).toEqual({
      "app.greeting.message": "Hello from cron",
      "app.cron.schedule": "*/5 * * * *",
      "app.cron.scheduled_time": "2026-04-20T12:00:00.000Z",
    });
  });
});
