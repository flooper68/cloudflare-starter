import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEMO_E2E_STATE,
  demoAdapterOptions,
  localDemoPlugins,
} from "../../apps/web/test/e2e/demo-vite.mjs";
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

describe("demo-mode E2E server", () => {
  it("is absent without E2E_DEMO_PORT and refuses builds or non-development modes", () => {
    expect(localDemoPlugins(undefined)).toEqual([]);
    expect(demoAdapterOptions(undefined)).toEqual({});
    expect(() => localDemoPlugins("4322; rm")).toThrow();
    const [plugin] = localDemoPlugins("4322");
    expect(() =>
      plugin.apply({}, { command: "build", mode: "production" })
    ).toThrow();
    expect(() =>
      plugin.apply({}, { command: "serve", mode: "production" })
    ).toThrow();
    expect(plugin.apply({}, { command: "serve", mode: "development" })).toBe(
      true
    );
    expect(demoAdapterOptions("4322")).toEqual({
      persistState: { path: DEMO_E2E_STATE },
    });
  });

  it("only turns demo mode on in src/lib/env.ts and detects source drift", () => {
    const [plugin] = localDemoPlugins("4322");
    const source = readFileSync("apps/web/src/lib/env.ts", "utf8");
    expect(plugin.transform(source, "/repo/other.ts")).toBeNull();
    const result = plugin.transform(source, "/repo/apps/web/src/lib/env.ts");
    expect(result?.code).toContain('"DEMO_MODE":"on"');
    expect(result?.code).toContain('"APP_URL":"http://localhost:4322"');
    expect(() =>
      plugin.transform("changed", "/repo/apps/web/src/lib/env.ts")
    ).toThrow();
  });
});
