import { describe, expect, it } from "vitest";

import { createMemoryLogger } from "../platform";
import { sayHello } from "./say-hello";

describe("sayHello", () => {
  it("logs the greeting with the time the job was queued", async () => {
    const logger = createMemoryLogger();
    await sayHello(
      { logger },
      { name: "Nicole" },
      { time: "2026-10-28T12:00:00.000Z" }
    );
    expect(logger.records).toEqual([
      expect.objectContaining({
        severity_text: "INFO",
        body: "greetings.hello",
        attributes: {
          "app.greeting.message": "Hello, Nicole",
          "app.greeting.queued_at": "2026-10-28T12:00:00.000Z",
        },
      }),
    ]);
  });
});
