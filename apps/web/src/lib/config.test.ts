import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseOptionalFeature,
  parsePlatformConfig,
} from "./config";

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
});

describe("platform config", () => {
  it("accepts the explicit adapter choices", () => {
    expect(
      parsePlatformConfig({ LOG_SINK: "workers-logs", ERROR_REPORTER: "none" })
    ).toEqual({ LOG_SINK: "workers-logs", ERROR_REPORTER: "none" });
  });

  it("has no defaults: a missing setting is an error that names it", () => {
    expect(() => parsePlatformConfig({ ERROR_REPORTER: "none" })).toThrow(
      new ConfigError(
        "LOG_SINK",
        "LOG_SINK is not set: set LOG_SINK to one of workers-logs, none in the vars of apps/web/wrangler.jsonc for every environment"
      )
    );
    expect(() =>
      parsePlatformConfig({ LOG_SINK: "none", ERROR_REPORTER: "" })
    ).toThrow(/^ERROR_REPORTER is not set/);
  });

  it("rejects values that name no adapter", () => {
    try {
      parsePlatformConfig({ LOG_SINK: "datadog", ERROR_REPORTER: "none" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe("LOG_SINK");
      expect((error as Error).message).toMatch(/^LOG_SINK is "datadog"/);
    }
  });
});
