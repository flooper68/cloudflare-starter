import { describe, expect, it } from "vitest";

import { deployedURL, parseSmokeArgs } from "./smoke-args";

describe("deployedURL", () => {
  it("is the custom domain or the route's host, as https", () => {
    expect(
      deployedURL({
        routes: [{ pattern: "starter.flooper.me", custom_domain: true }],
      })
    ).toBe("https://starter.flooper.me");
    expect(deployedURL({ routes: ["staging.example.com/*"] })).toBe(
      "https://staging.example.com"
    );
  });

  it("is undefined without a hostname route (workers.dev)", () => {
    expect(deployedURL({})).toBeUndefined();
    expect(deployedURL({ routes: [{ pattern: "*/*" }] })).toBeUndefined();
  });
});

describe("parseSmokeArgs", () => {
  it("reads --base-url in both spellings and keeps the rest for Playwright", () => {
    expect(
      parseSmokeArgs([
        "--",
        "--base-url",
        "https://starter.flooper.me/",
        "-g",
        "health",
      ])
    ).toEqual({
      ok: true,
      baseURL: "https://starter.flooper.me",
      playwright: ["-g", "health"],
    });
    expect(
      parseSmokeArgs(["--base-url=https://a.example.com/x"])
    ).toMatchObject({ ok: true, baseURL: "https://a.example.com" });
  });

  it("falls back to E2E_BASE_URL, and the flag wins over it", () => {
    expect(parseSmokeArgs([], "https://env.example.com")).toMatchObject({
      baseURL: "https://env.example.com",
    });
    expect(
      parseSmokeArgs(
        ["--base-url", "https://flag.example.com"],
        "https://env.example.com"
      )
    ).toMatchObject({ baseURL: "https://flag.example.com" });
  });

  it("refuses a missing, malformed or plain-http remote URL", () => {
    expect(parseSmokeArgs([]).ok).toBe(false);
    expect(parseSmokeArgs(["--base-url"]).ok).toBe(false);
    expect(parseSmokeArgs(["--base-url", "starter"]).ok).toBe(false);
    expect(parseSmokeArgs(["--base-url", "http://starter.flooper.me"]).ok).toBe(
      false
    );
    expect(parseSmokeArgs(["--base-url", "http://localhost:4321"]).ok).toBe(
      true
    );
  });
});
