/**
 * API tests do not depend on a developer's apps/web/.dev.vars: every var and secret the app
 * reads is pinned in apps/web/test/api-bindings.ts, which overrides what Wrangler loads.
 */
import { parseEnv } from "node:util";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";
import { parseAppConfig } from "../../apps/web/src/lib/config";
import { API_TEST_BINDINGS } from "../../apps/web/test/api-bindings";
import { read } from "./repo";

const devVarsKeys = read("apps/web/.dev.vars.example")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => line.slice(0, line.indexOf("=")));

const topLevelVars = (
  parse(read("apps/web/wrangler.jsonc")) as { vars: Record<string, string> }
).vars;

describe("API test bindings", () => {
  it("ships a parseable local example without overriding duplicate assignments", () => {
    expect(new Set(devVarsKeys).size).toBe(devVarsKeys.length);
    const example = parseEnv(read("apps/web/.dev.vars.example"));
    const values = Object.fromEntries(
      Object.entries({ ...topLevelVars, ...example }).map(([key, value]) => [
        key,
        value || undefined,
      ])
    );
    expect(() => parseAppConfig(values)).not.toThrow();
  });
  it("finds the .dev.vars.example keys", () => {
    expect(devVarsKeys).toContain("APP_ENV");
  });

  it.each(devVarsKeys)("pins %s from .dev.vars.example", (key) => {
    expect(Object.keys(API_TEST_BINDINGS)).toContain(key);
  });

  it.each(Object.entries(topLevelVars))(
    "pins %s to its top-level wrangler.jsonc value",
    (key, value) => {
      expect(API_TEST_BINDINGS).toHaveProperty(key, value);
    }
  );
});
