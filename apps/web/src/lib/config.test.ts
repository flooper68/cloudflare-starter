import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseAbuseConfig,
  parseAppConfig,
  parseOptionalFeature,
  parsePlatformConfig,
} from "./config";

const core = {
  APP_URL: "http://localhost:4321",
  BETTER_AUTH_SECRET: "local-dev-secret-change-me-0000000000",
  APP_ENV: "local",
};

describe("web config", () => {
  it("returns a disabled feature result when optional parsing fails", () => {
    const result = parseOptionalFeature("R2", () => {
      throw new Error("Missing one or more R2 environment variables");
    });

    expect(result).toEqual({
      enabled: false,
      value: null,
      reason:
        "R2 is not configured: Missing one or more R2 environment variables",
    });
  });

  it("parses the workspace settings with the rest of the config", () => {
    expect(
      parseAppConfig({
        ...core,
        WORKSPACE_MODE: "single",
        SIGN_UP: "invite",
        BOOTSTRAP_ADMIN_EMAIL: "founder@acme.test",
        ADMIN_PORTAL: "on",
      }).workspaces
    ).toEqual({
      mode: "single",
      signUp: "invite",
      signUpDomains: [],
      bootstrapAdminEmail: "founder@acme.test",
    });
  });

  it("requires ADMIN_PORTAL, on or off, without a default", () => {
    const workspaces = { WORKSPACE_MODE: "multi", SIGN_UP: "open" };
    expect(
      parseAppConfig({ ...core, ...workspaces, ADMIN_PORTAL: "off" })
        .ADMIN_PORTAL
    ).toBe("off");
    expect(() => parseAppConfig({ ...core, ...workspaces })).toThrow(
      /ADMIN_PORTAL is not set: set ADMIN_PORTAL to one of on, off/
    );
    expect(() =>
      parseAppConfig({ ...core, ...workspaces, ADMIN_PORTAL: "true" })
    ).toThrow(ConfigError);
  });

  it("refuses to start without WORKSPACE_MODE and SIGN_UP", () => {
    expect(() => parseAppConfig(core)).toThrow(/WORKSPACE_MODE must be/);
  });
});

describe("platform config", () => {
  it("accepts the explicit environment and adapter choices", () => {
    expect(
      parsePlatformConfig({
        APP_ENV: "staging",
        LOG_SINK: "workers-logs",
        ERROR_REPORTER: "none",
        FEATURE_FLAGS: "d1",
      })
    ).toEqual({
      APP_ENV: "staging",
      LOG_SINK: "workers-logs",
      ERROR_REPORTER: "none",
      FEATURE_FLAGS: "d1",
    });
  });

  it("requires APP_ENV: no default environment", () => {
    expect(() =>
      parsePlatformConfig({
        LOG_SINK: "none",
        ERROR_REPORTER: "none",
        FEATURE_FLAGS: "none",
      })
    ).toThrow(
      /^APP_ENV is not set: set APP_ENV to one of local, develop, staging, production/
    );
    expect(() =>
      parsePlatformConfig({
        APP_ENV: "Local",
        LOG_SINK: "none",
        ERROR_REPORTER: "none",
      })
    ).toThrow(/^APP_ENV is "Local"/);
  });

  it("has no defaults: a missing setting is an error that names it", () => {
    expect(() =>
      parsePlatformConfig({ APP_ENV: "local", ERROR_REPORTER: "none" })
    ).toThrow(
      new ConfigError(
        "LOG_SINK",
        "LOG_SINK is not set: set LOG_SINK to one of workers-logs, none in the vars of apps/web/wrangler.jsonc for every environment"
      )
    );
    expect(() =>
      parsePlatformConfig({
        APP_ENV: "local",
        LOG_SINK: "none",
        ERROR_REPORTER: "",
      })
    ).toThrow(/^ERROR_REPORTER is not set/);
  });

  it("requires FEATURE_FLAGS and accepts only d1 or none", () => {
    const rest = { APP_ENV: "local", LOG_SINK: "none", ERROR_REPORTER: "none" };
    expect(() => parsePlatformConfig(rest)).toThrow(
      new ConfigError(
        "FEATURE_FLAGS",
        "FEATURE_FLAGS is not set: set FEATURE_FLAGS to one of d1, none in the vars of apps/web/wrangler.jsonc for every environment"
      )
    );
    expect(() =>
      parsePlatformConfig({ ...rest, FEATURE_FLAGS: "launchdarkly" })
    ).toThrow(/^FEATURE_FLAGS is "launchdarkly"/);
    expect(
      parsePlatformConfig({ ...rest, FEATURE_FLAGS: "none" }).FEATURE_FLAGS
    ).toBe("none");
  });

  it("rejects values that name no adapter", () => {
    try {
      parsePlatformConfig({
        APP_ENV: "local",
        LOG_SINK: "datadog",
        ERROR_REPORTER: "none",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe("LOG_SINK");
      expect((error as Error).message).toMatch(/^LOG_SINK is "datadog"/);
    }
  });

  describe("abuse protection settings", () => {
    const on = {
      RATE_LIMITING: "cloudflare",
      TURNSTILE: "on",
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    };

    it("parses explicit settings", () => {
      expect(parseAbuseConfig(on)).toEqual(on);
      expect(
        parseAbuseConfig({ RATE_LIMITING: "none", TURNSTILE: "off" })
      ).toEqual({
        RATE_LIMITING: "none",
        TURNSTILE: "off",
        TURNSTILE_SITE_KEY: null,
        TURNSTILE_SECRET_KEY: null,
      });
    });

    it.each([
      ["RATE_LIMITING", { ...on, RATE_LIMITING: undefined }],
      ["RATE_LIMITING", { ...on, RATE_LIMITING: "redis" }],
      ["TURNSTILE", { ...on, TURNSTILE: undefined }],
      ["TURNSTILE_SITE_KEY", { ...on, TURNSTILE_SITE_KEY: "" }],
      ["TURNSTILE_SECRET_KEY", { ...on, TURNSTILE_SECRET_KEY: undefined }],
    ])("refuses a missing or wrong %s, naming it", (setting, env) => {
      let error: unknown;
      try {
        parseAbuseConfig(env);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe(setting);
    });
  });
});
