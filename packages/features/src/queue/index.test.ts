import { describe, expect, it } from "vitest";

import { parseQueueMessage } from "./index";

describe("queue", () => {
  it("parses valid hello queue message", () => {
    expect(
      parseQueueMessage({
        type: "hello",
        name: "Nicole",
        userId: "9f4c17b6-e154-4db2-b97b-08e09ec90f4e",
        queuedAt: "2026-04-19T18:00:00.000Z",
      })
    ).toMatchObject({ type: "hello", name: "Nicole" });
  });

  it("rejects invalid hello queue message", () => {
    expect(() =>
      parseQueueMessage({
        type: "hello",
        name: "",
        userId: "not-a-uuid",
        queuedAt: "bad",
      })
    ).toThrow();
  });
});
