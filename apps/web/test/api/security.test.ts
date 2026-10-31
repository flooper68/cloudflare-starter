import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { handleMcp } from "@/server/mcp/handler";
import { sessionOf } from "@/server/trpc/context";
import {
  APP_URL,
  callerFor,
  env,
  humanHeaders,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

function cookies(response: Response, previous = "") {
  const all = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((v) => {
        const n = v.indexOf("=");
        return [v.slice(0, n), v.slice(n + 1)];
      })
  );
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0] ?? "";
    const n = pair.indexOf("=");
    if (n > 0) all.set(pair.slice(0, n), pair.slice(n + 1));
  }
  return [...all].map(([k, v]) => `${k}=${v}`).join("; ");
}
let requestIp = 10;
const post = (runtime: AppEnv, path: string, body: unknown, cookie = "") =>
  getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        cookie,
        ...humanHeaders(`198.51.100.${++requestIp}`),
      },
      body: JSON.stringify(body),
    })
  );
async function code(uri: string) {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  return createOTP(base32.decode(secret)).totp();
}
async function caller(runtime: AppEnv, user: TestUser, cookie: string) {
  const current = await getAuth(runtime).api.getSession({
    headers: new Headers({ cookie }),
  });
  return callerFor(user, runtime, testRequestContext(), {
    session: sessionOf(current?.session ?? null),
    exchange: {
      headers: new Headers({ cookie, origin: APP_URL }),
      resHeaders: new Headers(),
    },
  });
}
async function enroll(runtime: AppEnv, user: TestUser) {
  const enabled = await post(
    runtime,
    "/two-factor/enable",
    { password: "test-password-1234" },
    user.cookie
  );
  expect(enabled.status).toBe(200);
  const data = (await enabled.json()) as {
    totpURI: string;
    backupCodes: string[];
  };
  const verified = await post(
    runtime,
    "/two-factor/verify-totp",
    { code: await code(data.totpURI) },
    cookies(enabled, user.cookie)
  );
  expect(verified.status).toBe(200);
  return { ...data, cookie: cookies(verified, cookies(enabled, user.cookie)) };
}
describe("second-factor assurance on real auth endpoints", () => {
  it("requires enrollment, then accepts only this verified session and refuses factor removal", async () => {
    const runtime = { ...env, TWO_FACTOR: "required" };
    const user = await signUp(
      "Ada Security",
      "ada-security@example.test",
      runtime
    );
    await expect(callerFor(user, runtime).health.hello()).rejects.toMatchObject(
      { cause: { code: "SECOND_FACTOR_ENROLLMENT_REQUIRED" } }
    );
    expect(
      (await callerFor(user, runtime).account.security.status()).enrolled
    ).toBe(false);
    const enrolled = await enroll(runtime, user);
    expect(
      (
        await (
          await caller(runtime, user, enrolled.cookie)
        ).account.security.status()
      ).verified
    ).toBe(true);
    await expect(
      (await caller(runtime, user, enrolled.cookie)).health.hello()
    ).resolves.toMatchObject({ user: user.email });
    await expect(callerFor(user, runtime).health.hello()).rejects.toMatchObject(
      { cause: { code: "STEP_UP_REQUIRED" } }
    );
    const removal = await post(
      runtime,
      "/two-factor/disable",
      { password: "test-password-1234" },
      enrolled.cookie
    );
    expect(removal.status).toBe(403);
  });
  it("does not authenticate a password until TOTP succeeds; recovery codes work once", async () => {
    const user = await signUp("Grace Security", "grace-security@example.test");
    const enrolled = await enroll(env, user);
    await post(env, "/sign-out", {}, enrolled.cookie);
    const countBefore = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'auth.sign_in' AND target_id = ?"
    )
      .bind(user.id)
      .first<{ count: number }>();
    const login = await post(env, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    });
    expect(await login.json()).toMatchObject({ twoFactorRedirect: true });
    const challenge = cookies(login);
    const countAfter = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'auth.sign_in' AND target_id = ?"
    )
      .bind(user.id)
      .first<{ count: number }>();
    expect(countAfter?.count).toBe(countBefore?.count);
    expect(
      await getAuth(env).api.getSession({
        headers: new Headers({ cookie: challenge }),
      })
    ).toBeNull();
    const failed = await post(
      env,
      "/two-factor/verify-totp",
      { code: "not-a-code" },
      challenge
    );
    expect(failed.status).toBe(401);
    const recovered = await post(
      env,
      "/two-factor/verify-backup-code",
      { code: enrolled.backupCodes[0] },
      challenge
    );
    expect(recovered.status).toBe(200);
    expect(
      (
        await (
          await caller(env, user, cookies(recovered, challenge))
        ).account.security.status()
      ).verified
    ).toBe(true);
    await post(env, "/sign-out", {}, cookies(recovered, challenge));
    const login2 = await post(env, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    });
    expect(
      (
        await post(
          env,
          "/two-factor/verify-backup-code",
          { code: enrolled.backupCodes[0] },
          cookies(login2)
        )
      ).status
    ).toBe(401);
  });
});

describe("security boundaries", () => {
  it("blocks an older unverified browser at OAuth consent and account mutations", async () => {
    const user = await signUp("Lin Boundary", "lin-boundary@example.test");
    const old = await post(env, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    });
    const oldCookie = cookies(old);
    await enroll(env, user);
    const consent = await post(
      env,
      "/oauth2/consent",
      { accept: true },
      oldCookie
    );
    expect(consent.status).toBe(403);
    expect(await consent.json()).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect(
      (
        await post(
          env,
          "/update-user",
          { name: "Unauthorized change" },
          oldCookie
        )
      ).status
    ).toBe(403);
    await expect(
      (await caller(env, user, oldCookie)).health.hello()
    ).rejects.toMatchObject({ cause: { code: "STEP_UP_REQUIRED" } });
  });
  it("remembers a verified device but rejects an expired trust record", async () => {
    const runtime = { ...env, TWO_FACTOR_TRUSTED_DEVICE_DAYS: "1" };
    const user = await signUp("Trust User", "trust@example.test", runtime);
    const setup = await enroll(runtime, user);
    await post(runtime, "/sign-out", {}, setup.cookie);
    const first = await post(runtime, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    });
    const verified = await post(
      runtime,
      "/two-factor/verify-totp",
      { code: await code(setup.totpURI), trustDevice: true },
      cookies(first)
    );
    expect(verified.status).toBe(200);
    const verifiedCookie = cookies(verified, cookies(first));
    const signedOut = await post(runtime, "/sign-out", {}, verifiedCookie);
    const remembered = await post(
      runtime,
      "/sign-in/email",
      { email: user.email, password: "test-password-1234" },
      cookies(signedOut, verifiedCookie)
    );
    expect(await remembered.json()).not.toHaveProperty("twoFactorRedirect");
    const rememberedCookie = cookies(
      remembered,
      cookies(signedOut, verifiedCookie)
    );
    const state = await (
      await caller(runtime, user, rememberedCookie)
    ).account.security.status();
    expect(state).toMatchObject({ verified: true, freshFactor: false });
    const out = await post(runtime, "/sign-out", {}, rememberedCookie);
    await env.DB.prepare(
      "UPDATE verification SET expires_at = 0 WHERE identifier LIKE 'trust-device-%' AND value = ?"
    )
      .bind(user.id)
      .run();
    const expired = await post(
      runtime,
      "/sign-in/email",
      { email: user.email, password: "test-password-1234" },
      cookies(out, rememberedCookie)
    );
    expect(await expired.json()).toMatchObject({ twoFactorRedirect: true });
  });
  it("locks an account after ten failed signed-in verifications across client IPs", async () => {
    const user = await signUp("Lockout User", "lockout@example.test");
    const setup = await enroll(env, user);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(
        (
          await post(
            env,
            "/two-factor/verify-totp",
            { code: "invalid-code" },
            setup.cookie
          )
        ).status
      ).toBe(401);
    }
    const locked = await post(
      env,
      "/two-factor/verify-totp",
      { code: await code(setup.totpURI) },
      setup.cookie
    );
    expect(locked.status).toBe(429);
    expect(await locked.json()).toMatchObject({
      code: "ACCOUNT_TEMPORARILY_LOCKED",
    });
  });
  it("binds MCP tokens to their exact live verified session", async () => {
    const user = await signUp("MCP User", "mcp-security@example.test");
    const setup = await enroll(env, user);
    const current = await getAuth(env).api.getSession({
      headers: new Headers({ cookie: setup.cookie }),
    });
    const request = async (sessionId?: string) => {
      const { token } = await getAuth(env).api.signJWT({
        body: {
          payload: {
            sub: user.id,
            azp: "security-test",
            iss: `${APP_URL}/api/auth`,
            aud: `${APP_URL}/mcp`,
            ...(sessionId ? { starter_session_id: sessionId } : {}),
          },
        },
      });
      return handleMcp(
        new Request(`${APP_URL}/mcp`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: {},
              clientInfo: { name: "security-test", version: "1" },
            },
          }),
        }),
        env,
        testRequestContext()
      );
    };
    expect((await request()).status).toBe(401);
    expect((await request("unrelated-session")).status).toBe(401);
    expect((await request(current?.session.id)).status).toBe(200);
    await post(env, "/sign-out", {}, setup.cookie);
    expect((await request(current?.session.id)).status).toBe(401);
  });
});

describe("administrator factor recovery", () => {
  it("requires a fresh browser administrator and resets another user's factors and sessions", async () => {
    const admin = await signUp("Recovery Admin", "recovery-admin@example.test");
    const adminSetup = await enroll(env, admin);
    await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
      .bind(admin.id)
      .run();
    const target = await signUp(
      "Recovery Target",
      "recovery-target@example.test"
    );
    await enroll(env, target);
    const asAdmin = await caller(env, admin, adminSetup.cookie);
    await expect(
      asAdmin.admin.users.resetSecondFactor({ userId: target.id })
    ).resolves.toEqual({ userId: target.id });
    expect(
      await env.DB.prepare(
        "SELECT two_factor_enabled AS enabled FROM user WHERE id = ?"
      )
        .bind(target.id)
        .first()
    ).toMatchObject({ enabled: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM session WHERE user_id = ?"
      )
        .bind(target.id)
        .first()
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM two_factor WHERE user_id = ?"
      )
        .bind(target.id)
        .first()
    ).toEqual({ count: 0 });
    await expect(
      asAdmin.admin.users.resetSecondFactor({ userId: admin.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await env.DB.prepare(
      "UPDATE session SET second_factor_at = ? WHERE user_id = ?"
    )
      .bind(Date.now() - 16 * 60_000, admin.id)
      .run();
    await expect(
      asAdmin.admin.users.resetSecondFactor({ userId: target.id })
    ).rejects.toMatchObject({ cause: { code: "STEP_UP_REQUIRED" } });
  });
});
