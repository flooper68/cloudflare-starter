/**
 * Feature flags stay a small, owned, temporary catalog (docs/guides/how-to-use-feature-flags.md):
 * every key the code evaluates is in FLAGS, every FLAGS entry is used and names an owner and
 * a removal condition, and only the feature-flags feature and the adapters call the
 * FeatureFlags port. Keys are string literals (lint rule lint/rules/flag-key-literal.grit),
 * which is what lets this test find them.
 */

import { describe, expect, it } from "vitest";
import { FLAGS } from "../../packages/features/src/feature-flags/domain/catalog";

import { filesUnder, read } from "./repo";

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.(test|stories|contract)\.tsx?$|\.contract\.ts$/;

const sources = [
  ...filesUnder("apps/web/src", SOURCE),
  ...filesUnder("packages/features/src", SOURCE),
  ...filesUnder("packages/ui/src", SOURCE),
].filter((path) => !TEST.test(path));

const CATALOG = "packages/features/src/feature-flags/domain/catalog.ts";

/** Flag keys at the call sites: evaluateFlag(x, "key", …), useFlag("key"), flag="key". */
const CALL_SITE =
  /\bevaluateFlag\(\s*[^,]+,\s*["']([^"']+)["']|\buseFlag\(\s*["']([^"']+)["']|\bflag=\{?\s*["']([^"']+)["']/g;

function keysUsedIn(path: string): string[] {
  return [...read(path).matchAll(CALL_SITE)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? ""
  );
}

const used = new Map<string, string[]>();
for (const path of sources) {
  for (const key of keysUsedIn(path)) {
    used.set(key, [...(used.get(key) ?? []), path]);
  }
}

describe("feature flags", () => {
  it("finds flag call sites", () => {
    expect(used.size).toBeGreaterThan(0);
  });

  it.each([...used.keys()])("%s is in the catalog (FLAGS)", (key) => {
    expect(
      Object.hasOwn(FLAGS, key),
      `add "${key}" to ${CATALOG}, or fix the key in ${used.get(key)?.join(", ")}`
    ).toBe(true);
  });

  it.each(Object.keys(FLAGS))(
    "%s is used somewhere (else remove it)",
    (key) => {
      expect(
        used.has(key),
        `nothing evaluates "${key}": remove it from ${CATALOG}`
      ).toBe(true);
    }
  );

  it.each(Object.entries(FLAGS))(
    "%s names an owner and a removal condition",
    (_key, definition) => {
      expect(definition.owner.trim()).not.toBe("");
      expect(definition.removeWhen.trim().length).toBeGreaterThanOrEqual(10);
    }
  );

  it("calls the FeatureFlags port only from feature-flags/ and the platform", () => {
    const allowed =
      /^packages\/features\/src\/(feature-flags|platform)\/|^apps\/web\/src\/server\/platform\.ts$/;
    const offenders = sources.filter(
      (path) =>
        !allowed.test(path) &&
        /\.get(Boolean|String|Number)Details\(/.test(read(path))
    );
    expect(
      offenders,
      "read flags with evaluateFlag(flags, key, subject) from the feature-flags barrel"
    ).toEqual([]);
  });
});
