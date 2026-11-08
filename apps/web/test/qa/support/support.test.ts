// Unit tests of the QA suite's pure helpers (the `unit` Vitest project; the journeys
// themselves run in Playwright against a deployed app).
import { describe, expect, it } from "vitest";

import { isQaAddress, newRunId, qaAddress } from "./address";
import { qaAdmin } from "./admin";
import { missingQaEnv, qaEnv, qaSkipReason } from "./env";
import { extractLinks, linkTo } from "./links";
import { qaPassword } from "./password";
import { isAppRequest } from "./routing";

const ENV = {
  QA_BASE_URL: "https://starter.flooper.me/some/path",
  QA_TOKEN: "qa-token-0123456789abcdefghijklmnopqrstuv",
};

describe("qaEnv", () => {
  it("reads the variables, the URL reduced to its origin", () => {
    expect(qaEnv(ENV)).toEqual({
      baseURL: "https://starter.flooper.me",
      token: ENV.QA_TOKEN,
      emailDomain: "qa.flooper.me",
    });
    expect(
      qaEnv({ ...ENV, QA_EMAIL_DOMAIN: "QA.Example.com" }).emailDomain
    ).toBe("qa.example.com");
  });

  it("names every missing variable and what it is, without any token", () => {
    expect(
      missingQaEnv({ QA_BASE_URL: ENV.QA_BASE_URL, QA_TOKEN: " " })
    ).toEqual(["QA_TOKEN"]);
    expect(() => qaEnv({ QA_TOKEN: ENV.QA_TOKEN })).toThrow(/QA_BASE_URL/);
    expect(() => qaEnv({})).toThrow(/QA_BASE_URL, QA_TOKEN/);
    let message = "";
    try {
      qaEnv({ QA_TOKEN: ENV.QA_TOKEN });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(ENV.QA_TOKEN);
    expect(qaSkipReason(ENV)).toBeNull();
    expect(qaSkipReason({})).toMatch(/^QA suite skipped: set QA_BASE_URL/);
  });

  it("refuses plain http except for localhost", () => {
    expect(() =>
      qaEnv({ ...ENV, QA_BASE_URL: "http://starter.flooper.me" })
    ).toThrow(/https/);
    expect(
      qaEnv({ ...ENV, QA_BASE_URL: "http://localhost:4321" }).baseURL
    ).toBe("http://localhost:4321");
  });
});

describe("QA addresses", () => {
  it("builds qa+<runId>-<role>@<domain>", () => {
    expect(qaAddress("20261108kqzt", "owner", "qa.flooper.me")).toBe(
      "qa+20261108kqzt-owner@qa.flooper.me"
    );
    expect(() => qaAddress("nope", "owner")).toThrow(/runId/);
    expect(() => qaAddress("20261108kqzt", "Owner A")).toThrow(/role/);
  });

  it("makes run ids of the date and four random letters", () => {
    const id = newRunId(new Date("2026-11-08T23:59:00Z"));
    expect(id).toMatch(/^20261108[a-z]{4}$/);
  });

  it("recognises QA suite addresses only", () => {
    expect(isQaAddress("qa+20261108kqzt-owner@qa.flooper.me")).toBe(true);
    expect(isQaAddress("qa+admin@qa.flooper.me")).toBe(false);
    expect(isQaAddress("qa+20261108kqzt-owner@flooper.me")).toBe(false);
    expect(isQaAddress("someone@qa.flooper.me")).toBe(false);
  });
});

describe("mail links", () => {
  const html =
    '<a href="https://starter.flooper.me/api/auth/verify-email?token=a&amp;callbackURL=%2F">Verify</a>';
  const text =
    "Open https://starter.flooper.me/api/auth/verify-email?token=a&callbackURL=%2F to verify.";

  it("collects links from the HTML and the text, once each", () => {
    expect(extractLinks(text, html)).toEqual([
      "https://starter.flooper.me/api/auth/verify-email?token=a&callbackURL=%2F",
    ]);
  });

  it("picks the app's link and refuses one to another origin", () => {
    const links = extractLinks(text, html);
    expect(
      linkTo(links, "https://starter.flooper.me", "/api/auth/verify-email")
    ).toBe(links[0]);
    expect(() =>
      linkTo(
        ["https://evil.example/api/auth/verify-email?token=a"],
        "https://starter.flooper.me",
        "/api/auth/verify-email"
      )
    ).toThrow(/another origin/);
    expect(() => linkTo([], "https://starter.flooper.me", "/x")).toThrow(
      /no https/
    );
  });
});

describe("passwords", () => {
  it("are derived per address, stable, and never the token", () => {
    const a = qaPassword("qa+20261108kqzt-a@qa.flooper.me", ENV.QA_TOKEN);
    expect(qaPassword("QA+20261108kqzt-A@qa.flooper.me", ENV.QA_TOKEN)).toBe(a);
    expect(
      qaPassword("qa+20261108kqzt-b@qa.flooper.me", ENV.QA_TOKEN)
    ).not.toBe(a);
    expect(a).not.toContain(ENV.QA_TOKEN);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });
});

describe("QA routing", () => {
  it("sends the token to the app's exact origin only", () => {
    const app = "https://starter.flooper.me";
    expect(
      isAppRequest("https://starter.flooper.me/api/auth/sign-up/email", app)
    ).toBe(true);
    for (const url of [
      "https://challenges.cloudflare.com/turnstile/v0/api.js",
      "http://starter.flooper.me/",
      "https://starter.flooper.me.evil.example/",
      "https://x.starter.flooper.me/",
      "https://starter.flooper.me:8443/",
      "not a url",
    ]) {
      expect(isAppRequest(url, app), url).toBe(false);
    }
  });
});

describe("the QA admin", () => {
  it("is qa+admin@ in the QA domain, with a password derived from the token", () => {
    const env = qaEnv(ENV);
    const admin = qaAdmin(env);
    expect(admin.email).toBe("qa+admin@qa.flooper.me");
    expect(admin.password).toBe(qaPassword(admin.email, ENV.QA_TOKEN));
    expect(isQaAddress(admin.email)).toBe(false);
  });
});
