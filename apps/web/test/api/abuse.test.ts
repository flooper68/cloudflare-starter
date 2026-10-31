/**
 * Abuse protection end to end through the real handlers: the Workers Rate Limiting
 * bindings of wrangler.jsonc (simulated by Miniflare), Better Auth's own limiter, and
 * Turnstile against Siteverify answered by test/outbound.ts. Each test uses its own
 * client IP so counters do not leak between tests. Windows are aligned to the clock, so
 * loops allow up to twice the limit (one window boundary) before expecting a refusal.
 */
import {
  type AuditEvent,
  listAuditEvents,
  RATE_LIMIT_POLICIES,
  RateLimitedError,
  type RequestContext,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";
import type { APIContext } from "astro";
import { beforeAll, describe, expect, it } from "vitest";

import { ALL as authRoute } from "@/pages/api/auth/[...all]";
import { POST as uploadRoute } from "@/pages/api/files/index";
import { POST as unsubscribeRoute } from "@/pages/api/notifications/unsubscribe";
import { POST as trpcRoute } from "@/pages/api/trpc/[...trpc]";
import { getAuth, HUMAN_CHECK_HEADER } from "@/server/auth";
import { getDb } from "@/server/db";
import { handleMcp } from "@/server/mcp/handler";

import { TURNSTILE_DUMMY_TOKEN, TURNSTILE_FAIL_SECRET } from "../outbound";
import {
  APP_URL,
  callerFor,
  env,
  humanHeaders,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

/** A request context from this client IP, as the HTTP edge builds it. */
function from(ip: string): RequestContext {
  return { ...testRequestContext(), ip };
}

/** The Astro context of a route, with the request context the middleware would set. */
function context(request: Request, user: TestUser | null = null) {
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: {
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      requestContext: from(request.headers.get("cf-connecting-ip") ?? ""),
    },
  } as unknown as APIContext;
}

/** Sends requests until one is answered 429; fails after two windows' worth. */
async function until429(
  limit: number,
  send: () => Response | Promise<Response>
) {
  for (let call = 1; call <= limit * 2 + 1; call++) {
    const response = await send();
    if (response.status === 429) return { call, response };
  }
  throw new Error("never rate limited");
}

describe("rate limits", () => {
  let user: TestUser;
  let uploader: TestUser;
  beforeAll(async () => {
    user = await signUp("Nicole Example", "nicole@example.test");
    uploader = await signUp("Alan Turing", "alan@example.test");
  });

  it("answers a mutation over mutation.user with 429 and Retry-After", async () => {
    const { limit, periodSeconds } = RATE_LIMIT_POLICIES["mutation.user"];
    const { call, response } = await until429(limit, () =>
      trpcRoute(
        context(
          new Request(`${APP_URL}/api/trpc/queue.enqueueHello`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-trpc-source": "app",
              "cf-connecting-ip": "192.0.2.10",
            },
            body: JSON.stringify({ name: "Ada" }),
          }),
          user
        )
      )
    );
    expect(call).toBeGreaterThan(limit);
    expect(response.headers.get("retry-after")).toBe(String(periodSeconds));
    expect(response.headers.get("ratelimit-policy")).toBe(
      `"mutation.user";q=${limit};w=${periodSeconds}`
    );
    expect(response.headers.get("ratelimit")).toBe(
      `"mutation.user";r=0;t=${periodSeconds}`
    );
    const body = (await response.json()) as {
      error: { data: { code: string; appCode: string } };
    };
    expect(body.error.data.code).toBe("TOO_MANY_REQUESTS");
    expect(body.error.data.appCode).toBe("RATE_LIMITED");
  });

  it("limits storage.createUpload by upload.user, with the wait on the error", async () => {
    const { limit } = RATE_LIMIT_POLICIES["upload.user"];
    const caller = callerFor(user, env, from("192.0.2.11"));
    let refused: unknown;
    for (let call = 0; call <= limit * 2 && !refused; call++) {
      await caller.storage
        .createUpload({
          filename: "roadmap.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        })
        // Without R2 credentials the procedure itself fails; the limit runs first.
        .catch((error: unknown) => {
          if ((error as TRPCError).code === "TOO_MANY_REQUESTS")
            refused = error;
        });
    }
    expect(refused).toBeInstanceOf(TRPCError);
    const cause = (refused as TRPCError).cause;
    expect(cause).toBeInstanceOf(RateLimitedError);
    expect(cause).toMatchObject({
      policy: "upload.user",
      retryAfterSeconds: 60,
    });
  });

  it("answers POST /api/files over upload.user with 429 and Retry-After", async () => {
    const { limit } = RATE_LIMIT_POLICIES["upload.user"];
    const { response } = await until429(limit, () => {
      const form = new FormData();
      form.set(
        "file",
        new File(["Q4 roadmap"], "notes.txt", { type: "text/plain" })
      );
      return uploadRoute(
        context(
          new Request(`${APP_URL}/api/files`, {
            method: "POST",
            body: form,
            headers: { origin: APP_URL, "cf-connecting-ip": "192.0.2.12" },
          }),
          uploader
        )
      );
    });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    expect(response.headers.get("ratelimit")).toBe('"upload.user";r=0;t=60');
    expect(await response.json()).toEqual({
      type: "https://iana.org/assignments/http-problem-types#quota-exceeded",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests. Try again in 60 seconds.",
      instance: "/api/files",
      code: "RATE_LIMITED",
      "violated-policies": ["upload.user"],
      retryAfterSeconds: 60,
      reference: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });

  it("answers one-click unsubscribe over notifications.unsubscribe with 429, per IP", async () => {
    const { limit } = RATE_LIMIT_POLICIES["notifications.unsubscribe"];
    const { response } = await until429(limit, () =>
      unsubscribeRoute(
        context(
          new Request(
            `${APP_URL}/api/notifications/unsubscribe?t=not-a-token`,
            {
              method: "POST",
              headers: {
                "content-type": "application/x-www-form-urlencoded",
                "cf-connecting-ip": "192.0.2.30",
              },
              body: "List-Unsubscribe=One-Click",
            }
          )
        )
      )
    );
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit-policy")).toBe(
      '"notifications.unsubscribe";q=20;w=60'
    );
    expect(await response.json()).toMatchObject({
      status: 429,
      instance: "/api/notifications/unsubscribe",
      "violated-policies": ["notifications.unsubscribe"],
    });
  });

  it("answers /api/auth/* over auth.ip with 429 before Better Auth runs", async () => {
    const { limit } = RATE_LIMIT_POLICIES["auth.ip"];
    const { response } = await until429(limit, () =>
      authRoute(
        context(
          new Request(`${APP_URL}/api/auth/get-session`, {
            headers: { "cf-connecting-ip": "192.0.2.13" },
          })
        )
      )
    );
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit-policy")).toBe(
      '"auth.ip";q=60;w=60'
    );
    expect(await response.json()).toMatchObject({
      status: 429,
      instance: "/api/auth/get-session",
      "violated-policies": ["auth.ip"],
    });
  });

  it("names the quotas on allowed auth requests", async () => {
    const response = await authRoute(
      context(
        new Request(`${APP_URL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: APP_URL,
            ...humanHeaders("192.0.2.16"),
          },
          body: JSON.stringify({
            email: "nicole@example.test",
            password: "test-password-1234",
          }),
        })
      )
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("ratelimit-policy")).toBe(
      '"auth.ip";q=60;w=60, "auth.sign-in";q=10;w=60'
    );
  });

  it("answers repeated sign-ins with 429 and Retry-After (Better Auth's auth.sign-in)", async () => {
    const { limit } = RATE_LIMIT_POLICIES["auth.sign-in"];
    const { call, response } = await until429(limit, () =>
      authRoute(
        context(
          new Request(`${APP_URL}/api/auth/sign-in/email`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: APP_URL,
              ...humanHeaders("192.0.2.14"),
            },
            body: JSON.stringify({
              email: "nicole@example.test",
              password: "wrong-password-1234",
            }),
          })
        )
      )
    );
    // Better Auth's own D1 counter: exact, so the 11th attempt is refused.
    expect(call).toBe(limit + 1);
    const wait = Number(response.headers.get("retry-after"));
    expect(wait).toBeGreaterThan(0);
    expect(response.headers.get("ratelimit")).toBe(
      `"auth.sign-in";r=0;t=${wait}`
    );
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    expect(await response.json()).toMatchObject({
      "violated-policies": ["auth.sign-in"],
      retryAfterSeconds: wait,
    });
    // Eleven sign-ins each verify a password hash; with the other API files running in
    // parallel (admin.test.ts signs up many users) that can pass the default 5 s.
  }, 15_000);

  it("limits anonymous verification mails to auth.verification-email (3 a minute per IP)", async () => {
    const { limit } = RATE_LIMIT_POLICIES["auth.verification-email"];
    const { call, response } = await until429(limit, () =>
      authRoute(
        context(
          new Request(`${APP_URL}/api/auth/send-verification-email`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: APP_URL,
              "cf-connecting-ip": "192.0.2.17",
            },
            body: JSON.stringify({ email: "stranger@example.test" }),
          })
        )
      )
    );
    expect(call).toBe(limit + 1);
    expect(await response.json()).toMatchObject({
      code: "RATE_LIMITED",
      "violated-policies": ["auth.verification-email"],
    });
  });

  it("answers /mcp over mcp.ip with a JSON-RPC 429 before verifying the token", async () => {
    const { limit } = RATE_LIMIT_POLICIES["mcp.ip"];
    const { response } = await until429(limit, () =>
      handleMcp(
        new Request(`${APP_URL}/mcp`, {
          method: "POST",
          headers: { "cf-connecting-ip": "192.0.2.15" },
          body: "{}",
        }),
        env,
        from("192.0.2.15")
      )
    );
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit")).toBe('"mcp.ip";r=0;t=60');
    expect(await response.json()).toMatchObject({
      jsonrpc: "2.0",
      error: { data: { retryAfterSeconds: 60 } },
    });
  });

  it("answers /mcp over mcp.user for one token user, whatever the IP", async () => {
    // An access token like the ones Better Auth's MCP OAuth server issues.
    const { token } = await getAuth(env).api.signJWT({
      body: {
        payload: {
          sub: user.id,
          starter_session_id: (
            await getAuth(env).api.getSession({
              headers: new Headers({ cookie: user.cookie }),
            })
          )?.session.id,
          azp: "abuse-test-client",
          aud: `${APP_URL}/mcp`,
          iss: `${APP_URL}/api/auth`,
        },
      },
    });
    let request = 0;
    const send = () => {
      // A new IP per request, so mcp.ip never trips: only mcp.user can refuse.
      const ip = `198.18.${Math.floor(request / 250)}.${(request++ % 250) + 1}`;
      return handleMcp(
        new Request(`${APP_URL}/mcp`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        }),
        env,
        from(ip)
      );
    };
    const first = await send();
    expect(first.status).toBe(200);
    expect(first.headers.get("ratelimit-policy")).toBe(
      '"mcp.ip";q=600;w=60, "mcp.user";q=120;w=60'
    );
    const { limit } = RATE_LIMIT_POLICIES["mcp.user"];
    const { response } = await until429(limit, send);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toMatchObject({
      error: { data: { code: "RATE_LIMITED", retryAfterSeconds: 60 } },
    });
  });
});

/** Failed human checks recorded for an email, newest first. */
async function humanCheckEvents(email: string): Promise<AuditEvent[]> {
  const page = await listAuditEvents(
    { db: getDb(env) },
    {
      action: "auth.human_check_failed",
      targetType: "email",
      targetId: email,
      limit: 10,
    }
  );
  return [...page.events];
}

describe("human check (Turnstile)", () => {
  const signUpRequest = (email: string, headers: Record<string, string>) =>
    new Request(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        ...headers,
      },
      body: JSON.stringify({
        name: "Grace Hopper",
        email,
        password: "test-password-1234",
      }),
    });

  it("passes sign-up with the always-pass secret and the dummy token", async () => {
    const response = await getAuth(env).handler(
      signUpRequest("grace@example.test", humanHeaders("192.0.2.20"))
    );
    expect(response.status).toBe(200);
  });

  it("refuses sign-up without a token", async () => {
    const response = await getAuth(env).handler(
      signUpRequest("eve@example.test", { "cf-connecting-ip": "192.0.2.21" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
    const [event] = await humanCheckEvents("eve@example.test");
    expect(event).toMatchObject({
      outcome: "failure",
      target: { type: "email", id: "eve@example.test" },
      metadata: { form: "sign-up", reason: "missing" },
    });
  });

  it("refuses sign-up when Siteverify rejects the token (always-fail secret)", async () => {
    const failing = { ...env, TURNSTILE_SECRET_KEY: TURNSTILE_FAIL_SECRET };
    const response = await getAuth(failing).handler(
      signUpRequest("mallory@example.test", {
        [HUMAN_CHECK_HEADER]: TURNSTILE_DUMMY_TOKEN,
        "cf-connecting-ip": "192.0.2.22",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
    const [event] = await humanCheckEvents("mallory@example.test");
    expect(event?.metadata).toEqual({ form: "sign-up", reason: "rejected" });
  });

  it.each([
    [
      "/sign-in/email",
      { email: "grace@example.test", password: "x".repeat(12) },
    ],
    ["/request-password-reset", { email: "grace@example.test" }],
  ])("refuses %s without a token", async (path, body) => {
    const response = await getAuth(env).handler(
      new Request(`${APP_URL}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          "cf-connecting-ip": "192.0.2.23",
        },
        body: JSON.stringify(body),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
  });

  it("answers a failed human check on the route with Problem Details", async () => {
    const response = await authRoute(
      context(
        new Request(`${APP_URL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: APP_URL,
            "cf-connecting-ip": "192.0.2.24",
          },
          body: JSON.stringify({
            name: "Eve Example",
            email: "eve@example.test",
            password: "test-password-1234",
          }),
        })
      )
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    expect(await response.json()).toEqual({
      type: expect.stringMatching(/#human-check-failed$/),
      title: "Human check failed",
      status: 400,
      detail: "The human check did not pass. Try again.",
      instance: "/api/auth/sign-up/email",
      code: "HUMAN_CHECK_FAILED",
      reference: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
  });
});
