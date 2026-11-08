/**
 * The QA outbox, the QA cleanup and the QA admin through the real handlers
 * (docs/guides/how-to-qa-a-deployment.md#the-qa-outbox): QA_BYPASS=on in the API test
 * bindings with QA_EMAIL_DOMAIN qa.flooper.me and a test QA_TOKEN.
 */
import {
  findAdminAccess,
  limitKey,
  listAuditEvents,
  listQaMail,
  QA_TOKEN_HEADER,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { buildEmailFeature } from "@/lib/env";
import { POST as cleanupRoute } from "@/pages/api/qa/cleanup";
import {
  DELETE as clearRoute,
  GET as outboxRoute,
} from "@/pages/api/qa/outbox";
import { AUTH_BASE_PATH, getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { qaEndpoint } from "@/server/qa-endpoint";

import { API_TEST_BINDINGS } from "../api-bindings";
import {
  APP_URL,
  browserCallerFor,
  env,
  humanHeaders,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const TOKEN = API_TEST_BINDINGS.QA_TOKEN;
const DOMAIN = API_TEST_BINDINGS.QA_EMAIL_DOMAIN;
const ADMIN = `qa+admin@${DOMAIN}`;

let nextIp = 0;
function freshIp(): string {
  nextIp += 1;
  return `198.51.100.${150 + nextIp}`;
}

function context(request: Request, ip = freshIp()): APIContext {
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: {
      user: null,
      requestContext: { ...testRequestContext(), ip },
    },
  } as unknown as APIContext;
}

function outbox(
  query: Record<string, string>,
  token: string | null = TOKEN,
  method: "GET" | "DELETE" = "GET"
): Promise<Response> {
  const request = new Request(
    `${APP_URL}/api/qa/outbox?${new URLSearchParams(query)}`,
    { method, headers: token ? { [QA_TOKEN_HEADER]: token } : {} }
  );
  return (method === "GET" ? outboxRoute : clearRoute)(
    context(request)
  ) as Promise<Response>;
}

function cleanup(
  body: unknown,
  token: string | null = TOKEN
): Promise<Response> {
  return cleanupRoute(
    context(
      new Request(`${APP_URL}/api/qa/cleanup`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { [QA_TOKEN_HEADER]: token } : {}),
        },
        body: JSON.stringify(body),
      })
    )
  ) as Promise<Response>;
}

/** Signs a QA address up through the bypass (the QA token, no Turnstile token). */
async function signUpQa(email: string): Promise<Response> {
  return getAuth(env).handler(
    new Request(`${APP_URL}${AUTH_BASE_PATH}/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        [QA_TOKEN_HEADER]: TOKEN,
        "cf-connecting-ip": freshIp(),
      },
      body: JSON.stringify({
        name: "QA",
        email,
        password: "qa-test-password-1234",
      }),
    })
  );
}

async function messages(to: string) {
  const response = await outbox({ to });
  expect(response.status).toBe(200);
  return ((await response.json()) as { messages: Record<string, unknown>[] })
    .messages;
}

async function roleOf(email: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT role FROM user WHERE email = ?")
    .bind(email)
    .first<{ role: string | null }>();
  return row?.role ?? null;
}

async function makeOld(email: string): Promise<void> {
  await env.DB.prepare("UPDATE user SET created_at = ? WHERE email = ?")
    .bind(Date.now() - 3 * 60 * 60 * 1000, email)
    .run();
}

async function verifyFromOutbox(email: string): Promise<void> {
  const [mail] = await messages(email);
  const link = /https?:\/\/\S+\/api\/auth\/verify-email\?[^\s"<]+/.exec(
    String(mail?.text)
  )?.[0];
  if (!link) throw new Error(`no verification link for ${email}`);
  const response = await getAuth(env).handler(
    new Request(link.replaceAll("&amp;", "&"), { headers: { origin: APP_URL } })
  );
  expect(response.status).toBeLessThan(400);
}

describe("the QA outbox", () => {
  it("keeps mail to a QA address instead of sending it, fully rendered", async () => {
    const run = `qa+20261108abcd-owner@${DOMAIN}`;
    expect((await signUpQa(run)).status).toBe(200);
    const [mail] = await messages(run);
    expect(mail).toMatchObject({ to: run, subject: "Verify your email" });
    // `from` reads as the From header does, display name included.
    expect(mail?.from).toMatch(/^".+" <[^@>]+@[^>]+>$/);
    expect(mail?.from).toBe((mail?.headers as Record<string, string>).from);
    expect(String(mail?.text)).toContain("/api/auth/verify-email?");
    expect(mail?.headers).toMatchObject({
      to: expect.stringContaining(run),
      subject: "Verify your email",
      "message-id": expect.stringMatching(/^<.+@example\.test>$/),
    });
  });

  it("keeps every header, the unsubscribe ones included", async () => {
    const to = `qa+20261108abcd-headers@${DOMAIN}`;
    const email = buildEmailFeature(env).value;
    if (!email) throw new Error("email is off in the API tests");
    await email.send({
      to: { email: to },
      subject: "Member joined",
      text: "t",
      html: "<p>t</p>",
      headers: {
        "List-Unsubscribe": "<https://example.test/u?t=x>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    const [mail] = await messages(to);
    expect(mail?.headers).toMatchObject({
      "list-unsubscribe": "<https://example.test/u?t=x>",
      "list-unsubscribe-post": "List-Unsubscribe=One-Click",
    });
  });

  it("sends everyone else's mail as before", async () => {
    await signUp("Real Person", "real-person@example.test");
    expect(
      await listQaMail(
        { db: getDb(env), clock: systemClock },
        { to: "real-person@example.test", since: null, subject: null }
      )
    ).toEqual([]);
  });

  it("refuses a missing or wrong token, a non-run address and a bad since", async () => {
    expect(
      (await outbox({ to: `qa+20261108abcd-owner@${DOMAIN}` }, null)).status
    ).toBe(401);
    expect(
      (await outbox({ to: `qa+20261108abcd-owner@${DOMAIN}` }, `${TOKEN}x`))
        .status
    ).toBe(401);
    for (const to of [
      `qa@${DOMAIN}`,
      "someone@example.test",
      `qa+x@${DOMAIN}`,
      "",
    ]) {
      expect((await outbox({ to })).status, to).toBe(400);
    }
    expect(
      (
        await outbox({
          to: `qa+20261108abcd-owner@${DOMAIN}`,
          since: "yesterday",
        })
      ).status
    ).toBe(400);
  });

  it("clears one address's mail", async () => {
    const to = `qa+20261108abcd-clear@${DOMAIN}`;
    expect((await signUpQa(to)).status).toBe(200);
    const response = await outbox({ to }, TOKEN, "DELETE");
    expect(await response.json()).toEqual({ deleted: 1 });
    expect(await messages(to)).toEqual([]);
  });

  it("answers 404 with QA_BYPASS=off, as if it did not exist", async () => {
    const off = { ...env, QA_BYPASS: "off" } as AppEnv;
    const response = await qaEndpoint(
      off,
      context(
        new Request(`${APP_URL}/api/qa/outbox?to=x`, {
          headers: { [QA_TOKEN_HEADER]: TOKEN },
        })
      ),
      "/api/qa/outbox",
      "qa.bypass",
      async () => new Response("reached")
    );
    expect(response.status).toBe(404);
  });

  it("is limited by qa.bypass per IP, before the token is compared", async () => {
    const ip = freshIp();
    const binding = env.RL_QA_BYPASS as RateLimit;
    const key = limitKey("qa.bypass", { userId: null, ip });
    for (let call = 0; call <= 60; call++) {
      if (!(await binding.limit({ key })).success) break;
    }
    const response = (await outboxRoute(
      context(
        new Request(
          `${APP_URL}/api/qa/outbox?to=qa%2B20261108abcd-owner%40${DOMAIN}`,
          {
            headers: { [QA_TOKEN_HEADER]: TOKEN },
          }
        ),
        ip
      )
    )) as Response;
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      "violated-policies": ["qa.bypass"],
    });
  });
});

describe("QA addresses are the QA suite's", () => {
  it("refuses a sign-up to a QA address without the QA token, even with a real human check", async () => {
    const response = await getAuth(env).handler(
      new Request(`${APP_URL}${AUTH_BASE_PATH}/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          ...humanHeaders(freshIp()),
        },
        body: JSON.stringify({
          name: "Squatter",
          email: ADMIN,
          password: "squatter-password-1",
        }),
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "QA_ADDRESS_RESERVED",
    });
    expect(await roleOf(ADMIN)).toBeNull();
  });

  it("refuses an email change to a QA address without the QA token", async () => {
    const person = await signUp("Changer", "changer@example.test");
    const response = await getAuth(env).handler(
      new Request(`${APP_URL}${AUTH_BASE_PATH}/change-email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          cookie: person.cookie,
          "cf-connecting-ip": freshIp(),
        },
        body: JSON.stringify({ newEmail: ADMIN }),
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "QA_ADDRESS_RESERVED",
    });
  });
});

/** The QA admin as a test user with a cookie (signed in through the bypass). */
async function qaAdminUser(): Promise<TestUser> {
  const response = await getAuth(env).handler(
    new Request(`${APP_URL}${AUTH_BASE_PATH}/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        [QA_TOKEN_HEADER]: TOKEN,
        "cf-connecting-ip": freshIp(),
      },
      body: JSON.stringify({ email: ADMIN, password: "qa-test-password-1234" }),
    })
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { user: { id: string } };
  const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  return { id: body.user.id, email: ADMIN, name: "QA", cookie };
}

describe("the QA admin", () => {
  it("is promoted once verified through the outbox, audited, with a short session", async () => {
    expect((await signUpQa(ADMIN)).status).toBe(200);
    expect(await roleOf(ADMIN)).not.toBe("admin");
    await verifyFromOutbox(ADMIN);
    expect(await roleOf(ADMIN)).toBe("admin");
    const id = (
      await env.DB.prepare("SELECT id FROM user WHERE email = ?")
        .bind(ADMIN)
        .first<{ id: string }>()
    )?.id as string;
    const page = await listAuditEvents(
      { db: getDb(env) },
      {
        action: "qa.admin.promoted",
        targetType: "user",
        targetId: id,
        limit: 5,
      }
    );
    expect(page.events).toHaveLength(1);
    const sessions = await env.DB.prepare(
      "SELECT expires_at FROM session WHERE user_id = ?"
    )
      .bind(id)
      .all<{ expires_at: number }>();
    expect(sessions.results.length).toBeGreaterThan(0);
    for (const session of sessions.results) {
      expect(session.expires_at).toBeLessThanOrEqual(
        Date.now() + 60 * 60 * 1000 + 5_000
      );
    }
  });

  it("can send the admin test email to any address, from a fresh browser session", async () => {
    const qa = await qaAdminUser();
    const { caller } = browserCallerFor(qa, { signedInMinutesAgo: 5 });
    await expect(
      caller.admin.email.sendTest({ to: "delivery@example.test" })
    ).resolves.toEqual({ sent: true });
  });

  it("is an admin only within an hour of a browser sign-in, never over MCP", async () => {
    const qa = await qaAdminUser();
    const access = (
      sessionCreatedAt: Date | null,
      qaAdminEmail: string | null = ADMIN
    ) =>
      findAdminAccess(
        { db: getDb(env), clock: systemClock },
        { userId: qa.id, qaAdminEmail, sessionCreatedAt }
      ).then((result) => result.isAdmin);
    expect(await access(new Date(Date.now() - 5 * 60 * 1000))).toBe(true);
    expect(await access(new Date(Date.now() - 61 * 60 * 1000))).toBe(false);
    expect(await access(null)).toBe(false);
    // The bypass off, or another QA_EMAIL_DOMAIN: no admin at all.
    expect(await access(new Date(), null)).toBe(false);
    expect(await access(new Date(), "qa+admin@other.example.test")).toBe(false);
    const { caller } = browserCallerFor(qa, { signedInMinutesAgo: 90 });
    await expect(caller.admin.overview.get()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is never created or claimed by Google or any other sign-in method without the token", async () => {
    const off = (await import("@/server/qa-admin")).refuseQaUserWithoutToken;
    expect(() =>
      off(
        env,
        { email: `qa+20261108abcd-google@${DOMAIN}` },
        { headers: new Headers() }
      )
    ).toThrow(/reserved/);
    expect(() =>
      off(
        env,
        { email: `qa+20261108abcd-google@${DOMAIN}` },
        { headers: new Headers({ [QA_TOKEN_HEADER]: TOKEN }) }
      )
    ).not.toThrow();
    expect(() =>
      off(env, { email: "google-person@example.test" }, null)
    ).not.toThrow();
    const qa = await qaAdminUser();
    const { refuseSocialQaAccount } = await import("@/server/qa-admin");
    const auth = {
      findUser: async () => ({ id: qa.id, email: ADMIN, emailVerified: true }),
      gateway: {} as never,
    };
    await expect(
      refuseSocialQaAccount(env, auth, { userId: qa.id, providerId: "google" })
    ).rejects.toThrow(/reserved/);
    await expect(
      refuseSocialQaAccount(env, auth, {
        userId: qa.id,
        providerId: "credential",
      })
    ).resolves.toBeUndefined();
  });

  it("is no admin, and is demoted with its sessions revoked at sign-in, with QA_BYPASS=off", async () => {
    const qa = await qaAdminUser();
    const off = { ...env, QA_BYPASS: "off" } as AppEnv;
    const signedIn = await getAuth(off).handler(
      new Request(`${APP_URL}${AUTH_BASE_PATH}/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          ...humanHeaders(freshIp()),
        },
        body: JSON.stringify({
          email: ADMIN,
          password: "qa-test-password-1234",
        }),
      })
    );
    // The demotion revokes every session, the one being created too: no sign-in.
    expect(signedIn.status).toBe(401);
    expect(await roleOf(ADMIN)).toBe("user");
    const sessions = await env.DB.prepare(
      "SELECT count(*) AS n FROM session WHERE user_id = ?"
    )
      .bind(qa.id)
      .first<{ n: number }>();
    expect(sessions?.n).toBe(0);
    const page = await listAuditEvents(
      { db: getDb(env) },
      {
        action: "qa.admin.demoted",
        targetType: "user",
        targetId: qa.id,
        limit: 5,
      }
    );
    expect(page.events).toHaveLength(1);
  });

  it("is never someone else's address: qa+admin@ of another domain is not promoted", async () => {
    const other = "qa+admin@example.test";
    await signUp("Not QA", other);
    expect(await roleOf(other)).not.toBe("admin");
  });
});

describe("the QA cleanup", () => {
  it("erases one run's accounts, and nobody else's", async () => {
    const runA = [`qa+20261109aaaa-a@${DOMAIN}`, `qa+20261109aaaa-b@${DOMAIN}`];
    const runB = `qa+20261109bbbb-a@${DOMAIN}`;
    for (const email of [...runA, runB])
      expect((await signUpQa(email)).status).toBe(200);
    const response = await cleanup({ runId: "20261109aaaa" });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      erased: string[];
      remaining: string[];
    };
    expect([...result.erased].sort()).toEqual([...runA].sort());
    expect(result.remaining).toEqual([]);
    for (const email of runA) expect(await roleOf(email)).toBeNull();
    expect(
      await env.DB.prepare("SELECT 1 AS x FROM user WHERE email = ?")
        .bind(runB)
        .first()
    ).not.toBeNull();
  });

  it("without a runId erases only run accounts older than two hours, never the QA admin or anyone else", async () => {
    const old = `qa+20261109cccc-a@${DOMAIN}`;
    const young = `qa+20261109dddd-a@${DOMAIN}`;
    const tagged = `qa+someone@${DOMAIN}`;
    for (const email of [old, young, tagged])
      expect((await signUpQa(email)).status).toBe(200);
    await signUp("Person", "old-person@example.test");
    for (const email of [old, tagged, ADMIN, "old-person@example.test"])
      await makeOld(email);
    const result = (await (await cleanup({})).json()) as { erased: string[] };
    expect(result.erased).toContain(old);
    for (const kept of [young, tagged, ADMIN, "old-person@example.test"]) {
      expect(result.erased).not.toContain(kept);
      expect(
        await env.DB.prepare("SELECT 1 AS x FROM user WHERE email = ?")
          .bind(kept)
          .first(),
        kept
      ).not.toBeNull();
    }
  });

  it("refuses without the token, a bad runId or a non-JSON body", async () => {
    expect((await cleanup({}, null)).status).toBe(401);
    expect((await cleanup({ runId: "x; DROP" })).status).toBe(400);
    expect((await cleanup({ runId: 5 })).status).toBe(400);
  });
});
