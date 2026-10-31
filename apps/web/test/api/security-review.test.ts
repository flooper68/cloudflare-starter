import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { handleMcp } from "@/server/mcp/handler";
import {
  GOOGLE_TEST_CLIENT_ID,
  GOOGLE_TEST_CLIENT_SECRET,
  googleIdToken,
} from "../google-fixture";
import {
  APP_URL,
  env,
  humanHeaders,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

let ip = 20;
function cookies(response: Response, previous = "") {
  const map = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((value) => {
        const i = value.indexOf("=");
        return [value.slice(0, i), value.slice(i + 1)];
      })
  );
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0] ?? "";
    const i = pair.indexOf("=");
    if (i > 0) map.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return [...map].map(([key, value]) => `${key}=${value}`).join("; ");
}
const post = (runtime: AppEnv, path: string, body: unknown, cookie = "") =>
  getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        cookie,
        ...humanHeaders(`198.51.100.${++ip}`),
      },
      body: JSON.stringify(body),
    })
  );
const tokenPost = (runtime: AppEnv, body: Record<string, string>) =>
  getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...humanHeaders(`198.51.100.${++ip}`),
      },
      body: new URLSearchParams(body),
    })
  );
async function totp(uri: string) {
  return createOTP(
    base32.decode(new URL(uri).searchParams.get("secret") ?? "")
  ).totp();
}
async function enroll(runtime: AppEnv, user: TestUser) {
  const response = await post(
    runtime,
    "/two-factor/enable",
    { password: "test-password-1234" },
    user.cookie
  );
  expect(response.status).toBe(200);
  const data = (await response.json()) as {
    totpURI: string;
    backupCodes: string[];
  };
  const verified = await post(
    runtime,
    "/two-factor/verify-totp",
    { code: await totp(data.totpURI) },
    cookies(response, user.cookie)
  );
  expect(verified.status).toBe(200);
  return { ...data, cookie: cookies(verified, cookies(response, user.cookie)) };
}
async function oldSession(user: TestUser, runtime = env) {
  return cookies(
    await post(runtime, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    })
  );
}
async function mcp(runtime: AppEnv, token: string) {
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
          clientInfo: { name: "security-review", version: "1" },
        },
      }),
    }),
    runtime,
    testRequestContext()
  );
}

async function authorize(runtime: AppEnv, user: TestUser) {
  const redirect = "https://client.example.test/callback";
  const registered = await post(runtime, "/oauth2/register", {
    client_name: "Security review client",
    redirect_uris: [redirect],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid profile email offline_access",
    resources: [`${APP_URL}/mcp`],
  });
  expect(registered.status).toBe(201);
  const { client_id: clientId } = (await registered.json()) as {
    client_id: string;
  };
  const verifier =
    "security-review-verifier-0123456789abcdefghijklmnopqrstuvwxyz-0123456789";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid profile email offline_access",
    resource: `${APP_URL}/mcp`,
    state: "security-review-state",
    prompt: "consent",
  });
  const request = await getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth/oauth2/authorize?${query}`, {
      headers: { cookie: user.cookie },
    })
  );
  expect(request.status).toBe(302);
  const consentUrl = new URL(request.headers.get("location") ?? "", APP_URL);
  expect(consentUrl.pathname).toBe("/consent");
  const consent = await post(
    runtime,
    "/oauth2/consent",
    { accept: true, oauth_query: consentUrl.search.slice(1) },
    cookies(request, user.cookie)
  );
  expect(consent.status).toBe(200);
  const { url } = (await consent.json()) as { url: string };
  const code = new URL(url).searchParams.get("code");
  expect(code).toBeTruthy();
  const token = await tokenPost(runtime, {
    grant_type: "authorization_code",
    client_id: clientId,
    code: code ?? "",
    code_verifier: verifier,
    redirect_uri: redirect,
    resource: `${APP_URL}/mcp`,
  });
  expect(token.status).toBe(200);
  const tokens = (await token.json()) as {
    access_token: string;
    refresh_token: string;
  };
  expect(tokens.refresh_token).toBeTruthy();
  expect((await mcp(runtime, tokens.access_token)).status).toBe(200);
  return { clientId, ...tokens };
}

describe("independent security review regressions", () => {
  it("never reveals an enrolled social account's TOTP seed to an older unverified cookie", async () => {
    const user = await signUp("Social seed", "social-seed@example.test");
    const old = await oldSession(user);
    await enroll(env, user);
    // The account is now social-only, so Better Auth intentionally no longer asks for a password.
    const auth = await getAuth(env).$context;
    await auth.adapter.deleteMany({
      model: "account",
      where: [
        { field: "userId", value: user.id },
        { field: "providerId", value: "credential" },
      ],
    });
    const seed = await post(env, "/two-factor/get-totp-uri", {}, old);
    expect(seed.status).toBe(403);
    expect(await seed.json()).toMatchObject({ code: "STEP_UP_REQUIRED" });
  });
  it("enforces account lockout even when a signed pre-enrollment cookie says twoFactorEnabled=false", async () => {
    const user = await signUp("Cached flag", "cached-flag@example.test");
    const old = await oldSession(user);
    const setup = await enroll(env, user);
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect(
        (
          await post(
            env,
            "/two-factor/verify-totp",
            { code: "invalid-code" },
            old
          )
        ).status
      ).toBe(401);
    const refused = await post(
      env,
      "/two-factor/verify-totp",
      { code: await totp(setup.totpURI) },
      old
    );
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({
      code: "ACCOUNT_TEMPORARILY_LOCKED",
    });
  });
  it("refuses both direct email-code endpoints until a real authenticator is enrolled", async () => {
    const messages: string[] = [];
    const runtime: AppEnv = {
      ...env,
      TWO_FACTOR: "required",
      TWO_FACTOR_EMAIL_OTP: "on",
      EMAIL: {
        send: async (message: { text: string }) => {
          messages.push(message.text);
        },
      },
    };
    const user = await signUp(
      "Email shortcut",
      "email-shortcut@example.test",
      runtime
    );
    messages.length = 0;
    const sent = await post(runtime, "/two-factor/send-otp", {}, user.cookie);
    const delivered = messages
      .join("\n")
      .match(/verification code is (\d+)/)?.[1];
    const verified = await post(
      runtime,
      "/two-factor/verify-otp",
      { code: delivered ?? "000000" },
      cookies(sent, user.cookie)
    );
    expect.soft(sent.status).toBe(403);
    expect.soft(verified.status).toBe(403);
    expect.soft(delivered).toBeUndefined();
    expect(
      await env.DB.prepare(
        "SELECT two_factor_enabled AS enabled FROM user WHERE id = ?"
      )
        .bind(user.id)
        .first()
    ).toMatchObject({ enabled: 0 });
    // The same email route remains usable as recovery after verified TOTP enrollment.
    const setup = await enroll(runtime, user);
    await post(runtime, "/sign-out", {}, setup.cookie);
    const login = await post(runtime, "/sign-in/email", {
      email: user.email,
      password: "test-password-1234",
    });
    const challenge = cookies(login);
    messages.length = 0;
    const recovery = await post(runtime, "/two-factor/send-otp", {}, challenge);
    expect(recovery.status).toBe(200);
    const recoveryCode = messages
      .join("\n")
      .match(/verification code is (\d+)/)?.[1];
    expect(recoveryCode).toBeDefined();
    const completed = await post(
      runtime,
      "/two-factor/verify-otp",
      { code: recoveryCode },
      cookies(recovery, challenge)
    );
    expect(completed.status).toBe(200);
    const session = await getAuth(runtime).api.getSession({
      headers: new Headers({ cookie: cookies(completed, challenge) }),
    });
    expect(session?.session.amr).toBe("otp mfa");
  });
  it.each(["optional", "off"])(
    "revoked OAuth grant sessions cannot mint usable offline tokens in %s mode",
    async (mode) => {
      const runtime = { ...env, TWO_FACTOR: mode };
      const user = await signUp(
        "Offline client",
        `offline-${mode}@example.test`,
        runtime
      );
      const grant = await authorize(runtime, user);
      await post(runtime, "/sign-out", {}, user.cookie);
      const refresh = await tokenPost(runtime, {
        grant_type: "refresh_token",
        client_id: grant.clientId,
        refresh_token: grant.refresh_token,
        resource: `${APP_URL}/mcp`,
      });
      const body = (await refresh.json()) as {
        access_token?: string;
        error?: string;
      };
      expect.soft(refresh.status).toBe(400);
      expect.soft(body.error).toBe("invalid_grant");
      if (body.access_token)
        expect((await mcp(runtime, body.access_token)).status).toBe(401);
      expect((await mcp(runtime, grant.access_token)).status).toBe(401);
    }
  );
});

describe("social authentication and caller-owned fields", () => {
  const runtime: AppEnv = {
    ...env,
    GOOGLE_CLIENT_ID: GOOGLE_TEST_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: GOOGLE_TEST_CLIENT_SECRET,
  };
  it("challenges synthetic Google callbacks and direct ID-token sign-ins before granting a session", async () => {
    const email = "synthetic-social@example.test";
    const first = await post(runtime, "/sign-in/social", {
      provider: "google",
      idToken: { token: await googleIdToken(email) },
    });
    expect(first.status).toBe(200);
    const body = (await first.json()) as {
      user: { id: string; name: string; email: string };
    };
    const user: TestUser = { ...body.user, cookie: cookies(first) };
    const setup = await enroll(runtime, user);
    await post(runtime, "/sign-out", {}, setup.cookie);
    const invalidAudience = await post(runtime, "/sign-in/social", {
      provider: "google",
      idToken: { token: await googleIdToken(email, undefined, "other-client") },
    });
    expect(invalidAudience.status).toBe(401);
    const direct = await post(runtime, "/sign-in/social", {
      provider: "google",
      idToken: { token: await googleIdToken(email) },
    });
    const directBody = (await direct.json()) as { twoFactorRedirect?: boolean };
    expect(directBody.twoFactorRedirect).toBe(true);
    expect(
      await getAuth(runtime).api.getSession({
        headers: new Headers({ cookie: cookies(direct) }),
      })
    ).toBeNull();
    const verified = await post(
      runtime,
      "/two-factor/verify-totp",
      { code: await totp(setup.totpURI) },
      cookies(direct)
    );
    expect(verified.status).toBe(200);
    await post(runtime, "/sign-out", {}, cookies(verified, cookies(direct)));

    const kickoff = await post(runtime, "/sign-in/social", {
      provider: "google",
      callbackURL: `${APP_URL}/app/dashboard`,
    });
    const provider = new URL(((await kickoff.json()) as { url: string }).url);
    const callbackQuery = new URLSearchParams({
      state: provider.searchParams.get("state") ?? "",
      code: `security-fixture:${JSON.stringify({ email, nonce: provider.searchParams.get("nonce") ?? undefined })}`,
    });
    const callback = await getAuth(runtime).handler(
      new Request(`${APP_URL}/api/auth/callback/google?${callbackQuery}`, {
        headers: {
          cookie: cookies(kickoff),
          ...humanHeaders(`198.51.100.${++ip}`),
        },
      })
    );
    expect(callback.status).toBe(302);
    expect(
      new URL(callback.headers.get("location") ?? "", APP_URL).pathname
    ).toBe("/two-factor");
    expect(
      await getAuth(runtime).api.getSession({
        headers: new Headers({ cookie: cookies(callback, cookies(kickoff)) }),
      })
    ).toBeNull();
    expect(
      (
        await post(
          runtime,
          "/two-factor/verify-totp",
          { code: await totp(setup.totpURI) },
          cookies(callback, cookies(kickoff))
        )
      ).status
    ).toBe(200);
  });
  it("does not accept enrollment or assurance supplied in request bodies", async () => {
    const created = await post(env, "/sign-up/email", {
      name: "Forged fields",
      email: "forged-fields@example.test",
      password: "test-password-1234",
      twoFactorEnabled: true,
      amr: "otp mfa",
      secondFactorAt: new Date().toISOString(),
    });
    expect(created.status).toBe(200);
    const firstCookie = cookies(created);
    const before = await getAuth(env).api.getSession({
      headers: new Headers({ cookie: firstCookie }),
    });
    expect(before?.user.twoFactorEnabled).toBe(false);
    expect(before?.session.amr).toBe("");
    expect(before?.session.secondFactorAt).toBeNull();
    await post(
      env,
      "/update-user",
      {
        twoFactorEnabled: true,
        amr: "otp mfa",
        secondFactorAt: new Date().toISOString(),
      },
      firstCookie
    );
    await post(env, "/sign-out", {}, firstCookie);
    const login = await post(env, "/sign-in/email", {
      email: "forged-fields@example.test",
      password: "test-password-1234",
      amr: "otp mfa",
      secondFactorAt: new Date().toISOString(),
      twoFactorEnabled: true,
    });
    const current = await getAuth(env).api.getSession({
      headers: new Headers({ cookie: cookies(login) }),
    });
    expect(current?.user.twoFactorEnabled).toBe(false);
    expect(current?.session.amr).toBe("pwd");
    expect(current?.session.secondFactorAt).toBeNull();
  });
});
