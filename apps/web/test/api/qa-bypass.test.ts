/**
 * The automated QA suite's bypass of the human check through the real Better Auth handler
 * (docs/reference/abuse-protection.md#qa-bypass): QA_BYPASS=on in the API
 * test bindings, the test token in X-QA-Token, an address @qa.flooper.me, and no Turnstile
 * token. Every branch: off, wrong token, wrong domain, accepted (audited), rate limited.
 */
import {
  type AuditAction,
  type AuditEvent,
  limitKey,
  listAuditEvents,
  QA_TOKEN_HEADER,
  RATE_LIMIT_POLICIES,
} from "@cloudflare-starter/features";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_BASE_PATH, getAuth, HUMAN_CHECKED_PATHS } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { betterAuthResponse } from "@/server/rate-limited-response";

import { API_TEST_BINDINGS } from "../api-bindings";
import {
  APP_URL,
  humanHeaders,
  env as testEnv,
  testRequestContext,
} from "./helpers";

/** QA_BYPASS=on whatever the test bindings say (a project made from the template ships off). */
const env = { ...testEnv, QA_BYPASS: "on" } as AppEnv;

const TOKEN = API_TEST_BINDINGS.QA_TOKEN;
const DOMAIN = API_TEST_BINDINGS.QA_EMAIL_DOMAIN;

let nextIp = 0;
/** A documentation-range IP of its own per request group, so counters never leak. */
function freshIp(): string {
  nextIp += 1;
  return `198.51.100.${100 + nextIp}`;
}

function authRequest(
  path: string,
  body: Record<string, string>,
  headers: Record<string, string>
): Request {
  return new Request(`${APP_URL}${AUTH_BASE_PATH}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: APP_URL,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function signUpRequest(email: string, headers: Record<string, string>) {
  return authRequest(
    "/sign-up/email",
    { name: "QA Robot", email, password: "qa-test-password-1234" },
    headers
  );
}

async function eventsFor(
  action: AuditAction,
  email: string
): Promise<AuditEvent[]> {
  const page = await listAuditEvents(
    { db: getDb(env) },
    { action, targetType: "email", targetId: email, limit: 10 }
  );
  return [...page.events];
}

function warnings(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call: unknown[]) => JSON.stringify(call));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QA bypass of the human check", () => {
  it("covers exactly the human-checked endpoints", () => {
    expect(Object.keys(HUMAN_CHECKED_PATHS).sort()).toEqual([
      "/request-password-reset",
      "/sign-in/email",
      "/sign-up/email",
    ]);
  });

  it("skips Turnstile for a QA address with the right token, and records qa.bypass.used without the token", async () => {
    const email = `qa+api-accepted@${DOMAIN}`;
    const response = await getAuth(env).handler(
      signUpRequest(email, {
        [QA_TOKEN_HEADER]: TOKEN,
        "cf-connecting-ip": freshIp(),
      })
    );
    expect(response.status).toBe(200);
    const [event] = await eventsFor("qa.bypass.used", email);
    expect(event).toMatchObject({
      outcome: "success",
      target: { type: "email", id: email },
      metadata: { form: "sign-up" },
    });
    expect(JSON.stringify(event)).not.toContain(TOKEN);
    expect(await eventsFor("auth.human_check_failed", email)).toEqual([]);
  });

  it.each([
    [
      "/sign-in/email",
      "sign-in",
      { email: `qa+api-accepted@${DOMAIN}`, password: "qa-test-password-1234" },
    ],
    [
      "/request-password-reset",
      "password-reset",
      { email: `qa+api-accepted@${DOMAIN}` },
    ],
  ])("skips Turnstile on %s too", async (path, form, body) => {
    const before = (await eventsFor("qa.bypass.used", body.email)).length;
    const response = await getAuth(env).handler(
      authRequest(path, body, {
        [QA_TOKEN_HEADER]: TOKEN,
        "cf-connecting-ip": freshIp(),
      })
    );
    expect(response.status).toBe(200);
    const events = await eventsFor("qa.bypass.used", body.email);
    expect(events).toHaveLength(before + 1);
    expect(events[0]?.metadata).toEqual({ form });
  });

  it("falls back to Turnstile for a wrong token and logs a warning without it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const email = `qa+api-wrong-token@${DOMAIN}`;
    const wrong = `${TOKEN.slice(0, -1)}x`;
    const response = await getAuth(env).handler(
      signUpRequest(email, {
        [QA_TOKEN_HEADER]: wrong,
        "cf-connecting-ip": freshIp(),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
    expect(await eventsFor("qa.bypass.used", email)).toEqual([]);
    const logged = warnings(warn).filter((line) =>
      line.includes("qa.bypass.rejected")
    );
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("wrong_token");
    expect(logged[0]).not.toContain(wrong);
    expect(logged[0]).not.toContain(TOKEN);
  });

  it("falls back to Turnstile for an address outside the QA domain, even with the right token", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const email of [
      "robot@example.test",
      `robot@${DOMAIN}`,
      `qa+robot@sub.${DOMAIN}`,
      // Its first 320 characters end in the QA domain; Better Auth would use all of it.
      `qa+${"a".repeat(302)}@${DOMAIN}.attacker.example`,
    ]) {
      const response = await getAuth(env).handler(
        signUpRequest(email, {
          [QA_TOKEN_HEADER]: TOKEN,
          "cf-connecting-ip": freshIp(),
        })
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "HUMAN_CHECK_FAILED",
      });
      expect(await eventsFor("qa.bypass.used", email)).toEqual([]);
    }
    expect(
      warnings(warn).filter((line) => line.includes("wrong_domain"))
    ).toHaveLength(4);
  });

  it("keeps Turnstile working for everyone else (a real token, no QA header)", async () => {
    const response = await getAuth(env).handler(
      signUpRequest("someone@example.test", humanHeaders(freshIp()))
    );
    expect(response.status).toBe(200);
  });

  it("ignores the header entirely with QA_BYPASS=off", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const off = { ...env, QA_BYPASS: "off" } as AppEnv;
    const email = `qa+api-off@${DOMAIN}`;
    const response = await getAuth(off).handler(
      signUpRequest(email, {
        [QA_TOKEN_HEADER]: TOKEN,
        "cf-connecting-ip": freshIp(),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
    expect(await eventsFor("qa.bypass.used", email)).toEqual([]);
    expect(warnings(warn).some((line) => line.includes("qa.bypass"))).toBe(
      false
    );
  });

  it("limits requests that carry the header per IP (qa.bypass), answered as Problem Details", async () => {
    // Better Auth's own per-path limits (5 sign-ups a minute per IP) trip before 30
    // requests, so the qa.bypass counter of this IP is used up on the binding directly,
    // with the key the policy uses; then one more request carries the header.
    const ip = freshIp();
    const { limit } = RATE_LIMIT_POLICIES["qa.bypass"];
    const binding = env.RL_QA_BYPASS as RateLimit;
    const key = limitKey("qa.bypass", { userId: null, ip });
    // Windows are aligned to the clock: allow one boundary.
    for (let call = 0; call <= limit * 2; call++) {
      if (!(await binding.limit({ key })).success) break;
    }
    const email = `qa+api-limited@${DOMAIN}`;
    const request = signUpRequest(email, {
      [QA_TOKEN_HEADER]: TOKEN,
      "cf-connecting-ip": ip,
    });
    const response = await getAuth(env).handler(request);
    expect(response.status).toBe(429);
    expect(await eventsFor("qa.bypass.used", email)).toEqual([]);
    const answer = await betterAuthResponse(
      request,
      response,
      testRequestContext(),
      AUTH_BASE_PATH
    );
    expect(answer.status).toBe(429);
    expect(answer.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(answer.headers.get("ratelimit")).toContain('"qa.bypass";r=0');
    expect(await answer.json()).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      "violated-policies": ["qa.bypass"],
    });
    // A request without the header is not counted against qa.bypass at all.
    const human = await getAuth(env).handler(
      signUpRequest("human-same-ip@example.test", humanHeaders(ip))
    );
    expect(human.status).toBe(200);
  });
});
