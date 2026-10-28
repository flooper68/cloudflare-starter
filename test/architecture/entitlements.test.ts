/**
 * Plans, features and limits (docs/architecture/overview.md#plans-features-and-limits):
 * the billing catalog is only worth what is enforced.
 * - The catalog is valid (validateCatalog).
 * - Every feature is gated by a use case (`billing.requireFeature(…, "<key>")`) and every
 *   metric limited (`billing.requireLimit(…, "<key>", …)`) outside the billing feature.
 * - Every `current` metric's source is a measuring function the features package exports
 *   and billing/measure-metric.ts maps; every `period` metric is counted by a use case
 *   (`billing.recordUsage(…, "<key>", …)`).
 * - Every feature and metric key appears in an integration or API test that expects the
 *   refusal (`limit_reached`, LimitReachedError or FeatureNotIncludedError).
 */
import { describe, expect, it } from "vitest";

import * as features from "../../packages/features/src";
import {
  CATALOG,
  FEATURES,
  METRICS,
} from "../../packages/features/src/billing/domain";

import { filesUnder, read } from "./repo";

const notTest = /(?<!\.test)\.ts$/;
const callers = filesUnder("packages/features/src", notTest)
  .filter((path) => !path.startsWith("packages/features/src/billing/"))
  .map((path) => ({ path, source: read(path) }));

const refusalTests = [
  ...filesUnder("packages/features/src", /\.integration\.test\.ts$/),
  ...filesUnder("apps/web/test/api", /\.test\.ts$/),
]
  .map(read)
  .filter((source) =>
    /limit_reached|LimitReachedError|FeatureNotIncludedError/.test(source)
  );

/** `call(<anything>, "<key>"` across line breaks, as Biome formats it. */
const calls = (call: string, key: string) =>
  new RegExp(`\\.${call}\\(\\s*[^)]*?"${key.replace(/\./g, "\\.")}"`, "s");

const measureMetric = read("packages/features/src/billing/measure-metric.ts");

describe("billing catalog", () => {
  it("is valid", () => {
    expect(features.validateCatalog(CATALOG)).toEqual([]);
  });

  it.each(Object.keys(FEATURES))("feature %s is gated by a use case", (key) => {
    expect(
      callers.some(({ source }) => calls("requireFeature", key).test(source)),
      `call billing.requireFeature(workspaceId, "${key}") in the use case it gates`
    ).toBe(true);
  });

  it.each(Object.keys(METRICS))("metric %s is limited by a use case", (key) => {
    expect(
      callers.some(({ source }) => calls("requireLimit", key).test(source)),
      `call billing.requireLimit(workspaceId, "${key}", increment) where it grows`
    ).toBe(true);
  });

  it.each(
    Object.entries(METRICS).filter(([, metric]) => metric.kind === "current")
  )("current metric %s has a measuring function", (_key, metric) => {
    const [feature, name] = metric.source.split(".");
    expect(feature && name, "source is <feature>.<function>").toBeTruthy();
    expect(
      typeof (features as Record<string, unknown>)[name as string],
      `export ${name} from packages/features/src/${feature}`
    ).toBe("function");
    expect(measureMetric).toContain(`"${metric.source}": ${name}`);
  });

  it.each(
    Object.entries(METRICS).filter(([, metric]) => metric.kind === "period")
  )("period metric %s is counted by a use case", (key, metric) => {
    expect(metric.source).toBe("usage_counter");
    expect(
      callers.some(({ source }) => calls("recordUsage", key).test(source)),
      `call billing.recordUsage(workspaceId, "${key}", amount) after the action`
    ).toBe(true);
  });

  it.each([...Object.keys(FEATURES), ...Object.keys(METRICS)])(
    "%s has a test that expects the refusal",
    (key) => {
      expect(
        refusalTests.some((source) => source.includes(`"${key}"`)),
        `test that ${key} refuses with limit_reached (integration or API test)`
      ).toBe(true);
    }
  );
});
