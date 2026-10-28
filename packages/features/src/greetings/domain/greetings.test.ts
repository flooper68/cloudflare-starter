import { describe, expect, it } from "vitest";

import { helloGreeting } from "./greeting-log";
import { scheduledGreeting } from "./scheduled-greeting";

describe("greetings", () => {
  it("describes a consumed hello message", () => {
    expect(
      helloGreeting(
        {
          type: "hello",
          name: "Nicole",
          userId: "u1",
          queuedAt: "2026-04-20T12:00:00.000Z",
        },
        "staging"
      )
    ).toEqual({
      tag: "queue-hello",
      environment: "staging",
      message: "Hello, Nicole",
      userId: "u1",
      queuedAt: "2026-04-20T12:00:00.000Z",
    });
  });

  it("describes a cron run", () => {
    expect(
      scheduledGreeting({
        environment: "develop",
        cron: "*/5 * * * *",
        scheduledTime: Date.parse("2026-04-20T12:00:00.000Z"),
      })
    ).toEqual({
      tag: "cron-hello",
      message: "Hello from cron",
      environment: "develop",
      cron: "*/5 * * * *",
      scheduledTime: "2026-04-20T12:00:00.000Z",
    });
  });
});
