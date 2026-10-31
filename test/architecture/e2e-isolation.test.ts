import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { localTurnstilePlugins } from "../../apps/web/test/e2e/turnstile-vite.mjs";

describe("local E2E Turnstile transport", () => {
  it("is absent normally and refuses builds or non-development modes", () => {
    expect(localTurnstilePlugins(false)).toEqual([]);
    const [plugin] = localTurnstilePlugins(true);
    expect(() =>
      plugin.apply({}, { command: "build", mode: "production" })
    ).toThrow();
    expect(() =>
      plugin.apply({}, { command: "serve", mode: "production" })
    ).toThrow();
    expect(plugin.apply({}, { command: "serve", mode: "development" })).toBe(
      true
    );
  });

  it("only replaces the verifier's injected transport and detects source drift", () => {
    const [plugin] = localTurnstilePlugins(true);
    const source = readFileSync("apps/web/src/server/platform.ts", "utf8");
    expect(plugin.transform(source, "/repo/other.ts")).toBeNull();
    const result = plugin.transform(
      source,
      "/repo/apps/web/src/server/platform.ts"
    );
    expect(result?.code).toContain("e2eSiteverify(new Request(input, init))");
    expect(result?.code).toContain("createTurnstileVerifier({");
    expect(result?.code).toContain('abuse.TURNSTILE === "on"');
    expect(() =>
      plugin.transform("changed", "/repo/apps/web/src/server/platform.ts")
    ).toThrow();
  });
});
