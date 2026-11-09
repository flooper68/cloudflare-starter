import { describe, expect, it } from "vitest";
import { AnalyticsReadError } from "../../ports/analytics-reader";
import { describeAnalyticsReaderContract } from "../../ports/analytics-reader.contract";
import { createMemoryAnalyticsReader } from "./memory-analytics-reader";

describeAnalyticsReaderContract("memory", () => ({
  reader: createMemoryAnalyticsReader({
    answer: () => [{ one: 1 }],
    webAnalytics: () => ({ viewer: { ok: true } }),
  }),
  refused: createMemoryAnalyticsReader({
    answer: () => {
      throw new AnalyticsReadError("unauthorized", "refused");
    },
  }),
}));

describe("memory analytics reader", () => {
  it("keeps what it was asked, in order", async () => {
    const reader = createMemoryAnalyticsReader({ answer: () => [] });
    await reader.sql("SELECT 1");
    await reader.graphql("{ viewer }", {});
    expect(reader.asked).toEqual(["SELECT 1", "{ viewer }"]);
  });
});
