import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseAbuseConfig,
  parseAnalyticsConfig,
  parseAppConfig,
  parseOptionalFeature,
  parsePlatformConfig,
} from "./config";

const core = {
  STORAGE_RECONCILE: "off",
  TWO_FACTOR: "optional",
  TWO_FACTOR_EMAIL_OTP: "off",
  TWO_FACTOR_TRUSTED_DEVICE_DAYS: "0",
  PASSKEYS: "on",
  APP_URL: "http://localhost:4321",
  BETTER_AUTH_SECRET: "local-dev-secret-change-me-0000000000",
  APP_ENV: "local",
};

describe("web config", () => {
  it("requires an explicit storage reconciliation mode", () => {
    const settings = {
      APP_ENV: "local",
      LOG_SINK: "none",
      ERROR_REPORTER: "none",
      FEATURE_FLAGS: "none",
      METRICS: "none",
      TRACING: "none",
    };
    expect(() => parsePlatformConfig(settings)).toThrow(
      /STORAGE_RECONCILE is not set/
    );
    expect(() =>
      parsePlatformConfig({ ...settings, STORAGE_RECONCILE: "true" })
    ).toThrow(/STORAGE_RECONCILE/);
    expect(
      parsePlatformConfig({ ...settings, STORAGE_RECONCILE: "report" })
        .STORAGE_RECONCILE
    ).toBe("report");
  });
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
        BILLING: "off",
      }).workspaces
    ).toEqual({
      mode: "single",
      signUp: "invite",
      signUpDomains: [],
      bootstrapAdminEmail: "founder@acme.test",
    });
  });

  it("requires ADMIN_PORTAL, on or off, without a default", () => {
    const workspaces = {
      WORKSPACE_MODE: "multi",
      SIGN_UP: "open",
      BILLING: "off",
    };
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

  it("parses BILLING and refuses to start without it or with an unknown mode", () => {
    const workspaces = {
      WORKSPACE_MODE: "multi",
      SIGN_UP: "open",
      ADMIN_PORTAL: "on",
    };
    expect(
      parseAppConfig({ ...core, ...workspaces, BILLING: "manual" }).billing
    ).toEqual({ mode: "manual" });
    expect(() => parseAppConfig({ ...core, ...workspaces })).toThrow(
      /BILLING must be off, manual or provider/
    );
    expect(() =>
      parseAppConfig({ ...core, ...workspaces, BILLING: "stripe" })
    ).toThrow(/BILLING must be off, manual or provider/);
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
        METRICS: "analytics-engine",
        TRACING: "workers",
        STORAGE_RECONCILE: "off",
      })
    ).toEqual({
      APP_ENV: "staging",
      LOG_SINK: "workers-logs",
      ERROR_REPORTER: "none",
      FEATURE_FLAGS: "d1",
      METRICS: "analytics-engine",
      TRACING: "workers",
      STORAGE_RECONCILE: "off",
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
    const rest = {
      APP_ENV: "local",
      LOG_SINK: "none",
      ERROR_REPORTER: "none",
      METRICS: "none",
      TRACING: "none",
      STORAGE_RECONCILE: "off",
    };
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

  it("requires METRICS and TRACING and accepts only their adapters", () => {
    const rest = {
      APP_ENV: "local",
      LOG_SINK: "none",
      ERROR_REPORTER: "none",
      FEATURE_FLAGS: "none",
    };
    expect(() => parsePlatformConfig({ ...rest, TRACING: "none" })).toThrow(
      new ConfigError(
        "METRICS",
        "METRICS is not set: set METRICS to one of analytics-engine, none in the vars of apps/web/wrangler.jsonc for every environment"
      )
    );
    expect(() => parsePlatformConfig({ ...rest, METRICS: "none" })).toThrow(
      "TRACING is not set: set TRACING to one of workers, none in the vars of apps/web/wrangler.jsonc for every environment"
    );
    expect(() =>
      parsePlatformConfig({ ...rest, METRICS: "prometheus", TRACING: "none" })
    ).toThrow(/^METRICS is "prometheus"/);
    expect(() =>
      parsePlatformConfig({ ...rest, METRICS: "none", TRACING: "otlp" })
    ).toThrow(/^TRACING is "otlp"/);
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

describe("analytics config", () => {
  const secret = "analytics-id-secret-0123456789abcdef";

  it("parses both settings, with the secret and token they need", () => {
    expect(
      parseAnalyticsConfig({
        ANALYTICS: "analytics-engine",
        ANALYTICS_ID_SECRET: secret,
        WEB_ANALYTICS: "cloudflare",
        WEB_ANALYTICS_TOKEN: "0123abcd",
      })
    ).toEqual({
      ANALYTICS: "analytics-engine",
      ANALYTICS_ID_SECRET: secret,
      WEB_ANALYTICS: "cloudflare",
      WEB_ANALYTICS_TOKEN: "0123abcd",
    });
    expect(
      parseAnalyticsConfig({ ANALYTICS: "none", WEB_ANALYTICS: "none" })
    ).toEqual({
      ANALYTICS: "none",
      ANALYTICS_ID_SECRET: null,
      WEB_ANALYTICS: "none",
      WEB_ANALYTICS_TOKEN: null,
    });
  });

  it.each([
    [
      { WEB_ANALYTICS: "none" },
      "ANALYTICS",
      /ANALYTICS is not set: .*setup:analytics/,
    ],
    [{ ANALYTICS: "posthog", WEB_ANALYTICS: "none" }, "ANALYTICS", /"posthog"/],
    [{ ANALYTICS: "none" }, "WEB_ANALYTICS", /WEB_ANALYTICS is not set/],
    [
      { ANALYTICS: "analytics-engine", WEB_ANALYTICS: "none" },
      "ANALYTICS_ID_SECRET",
      /needs the ANALYTICS_ID_SECRET secret/,
    ],
    [
      {
        ANALYTICS: "analytics-engine",
        ANALYTICS_ID_SECRET: "too-short",
        WEB_ANALYTICS: "none",
      },
      "ANALYTICS_ID_SECRET",
      /32\+ characters/,
    ],
    [
      { ANALYTICS: "none", WEB_ANALYTICS: "cloudflare" },
      "WEB_ANALYTICS_TOKEN",
      /needs WEB_ANALYTICS_TOKEN/,
    ],
  ])("refuses %j naming %s", (env, setting, message) => {
    try {
      parseAnalyticsConfig(env);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe(setting);
      expect((error as Error).message).toMatch(message);
    }
  });
});
