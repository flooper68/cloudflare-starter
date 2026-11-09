/**
 * Contract every AnalyticsReader adapter passes. Each adapter has a `*.contract.test.ts`
 * that calls this suite with a harness whose backend answers `SELECT 1 AS one` with one
 * row `{ one: 1 }` and a GraphQL query with `{ viewer: { ok: true } }`.
 */
import { describe, expect, it } from "vitest";

import type { AnalyticsReader } from "./analytics-reader";

export interface AnalyticsReaderHarness {
  readonly reader: AnalyticsReader;
  /** A reader whose backend refuses the credentials. */
  readonly refused: AnalyticsReader;
}

export function describeAnalyticsReaderContract(
  name: string,
  makeHarness: () => AnalyticsReaderHarness
): void {
  describe(`AnalyticsReader contract: ${name}`, () => {
    it("answers SQL with rows of objects", async () => {
      const { reader } = makeHarness();
      expect(await reader.sql("SELECT 1 AS one")).toEqual([{ one: 1 }]);
    });

    it("answers GraphQL with the data", async () => {
      const { reader } = makeHarness();
      expect(await reader.graphql("{ viewer { ok } }", {})).toEqual({
        viewer: { ok: true },
      });
    });

    it("throws AnalyticsReadError when the backend refuses", async () => {
      const { refused } = makeHarness();
      await expect(refused.sql("SELECT 1 AS one")).rejects.toMatchObject({
        name: "AnalyticsReadError",
        reason: "unauthorized",
      });
    });
  });
}
