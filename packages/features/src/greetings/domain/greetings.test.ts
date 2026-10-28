import { describe, expect, it } from "vitest";

import { helloGreeting } from "./greeting-log";
import { helloJob } from "./hello-job";

describe("greetings", () => {
  it("describes a hello job that ran as app.* attributes", () => {
    expect(
      helloGreeting({ name: "Nicole", queuedAt: "2026-04-20T12:00:00.000Z" })
    ).toEqual({
      "app.greeting.message": "Hello, Nicole",
      "app.greeting.queued_at": "2026-04-20T12:00:00.000Z",
    });
  });

  it("declares the hello job with a name payload", () => {
    expect(helloJob.type).toBe("greetings.hello");
    expect(helloJob.payload.safeParse({ name: " Nicole " })).toMatchObject({
      success: true,
      data: { name: "Nicole" },
    });
    for (const bad of [{}, { name: "" }, { name: "x".repeat(101) }, null]) {
      expect(helloJob.payload.safeParse(bad).success).toBe(false);
    }
  });
});
