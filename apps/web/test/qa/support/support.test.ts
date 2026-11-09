// Unit tests of the QA suite's pure helpers (the `unit` Vitest project; the journeys
// themselves run in Playwright against a deployed app).
import { describe, expect, it } from "vitest";

import { isQaAddress, newRunId, qaAddress } from "./address";
import { qaAdmin } from "./admin";
import { missingQaEnv, qaEnv, qaSkipReason } from "./env";
import { authPolicies, waitFor } from "./limits";
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

describe("rate-limit pacing", () => {
  const minute = 60_000;

  it("a sign-up counts against auth.ip, qa.bypass and auth.sign-up", () => {
    expect(authPolicies("/sign-up/email")).toEqual([
      "auth.ip",
      "qa.bypass",
      "auth.sign-up",
    ]);
  });

  it("Better Auth's burst: 4 of 5 sign-ups, then a whole window of quiet, plus slack", () => {
    const t0 = 1_000_000;
    const burst = [t0, t0 + 20_000, t0 + 40_000];
    expect(waitFor("auth.sign-up", burst, t0 + 50_000)).toBe(0);
    const full = [...burst, t0 + 50_000];
    // The production run: the next sign-up went exactly a window after the last slot and
    // the server, whose clock saw that request a little later, still counted the burst.
    expect(waitFor("auth.sign-up", full, t0 + 50_000 + minute)).toBe(2_000);
    expect(waitFor("auth.sign-up", full, t0 + 52_000 + minute)).toBe(0);
  });

  it("a request within a window keeps a Better Auth burst going", () => {
    const t0 = 1_000_000;
    // Gaps under a window: one burst of four, however long it lasts.
    const chained = [t0, t0 + 55_000, t0 + 110_000, t0 + 165_000];
    expect(waitFor("auth.sign-up", chained, t0 + 200_000)).toBeGreaterThan(0);
  });
});
