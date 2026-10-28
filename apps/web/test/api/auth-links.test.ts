// Auth links carry tokens: with email off they are logged only in local development.
// A deployed environment refuses the link-sending endpoints instead, for every address.
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuth } from "@/server/auth";
import { EMAIL_NOT_CONFIGURED_MESSAGE } from "@/server/auth-mail";
import type { AppEnv } from "@/server/env";

import { APP_URL } from "./helpers";

function withoutEmail(appEnv: string): AppEnv {
  return { ...env, EMAIL_FROM: undefined, APP_ENV: appEnv } as AppEnv;
}

function post(target: AppEnv, path: string, body: unknown) {
  return getAuth(target).handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL },
      body: JSON.stringify(body),
    })
  );
}

/** Everything written to the console (the Workers Logs adapter), as one string. */
function consoleOutput() {
  const spies = (["debug", "info", "warn", "error"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {})
  );
  return () =>
    JSON.stringify(
      spies.flatMap((spy) => spy.mock.calls.map(([record]) => record))
    );
}

describe("auth links with email off", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the reset link in local development", async () => {
    const local = withoutEmail("local");
    const signUp = await post(local, "/sign-up/email", {
      name: "Nicole Example",
      email: "nicole@example.test",
      password: "test-password-1234",
    });
    expect(signUp.status).toBe(200);

    const output = consoleOutput();
    const reset = await post(local, "/request-password-reset", {
      email: "nicole@example.test",
      redirectTo: "/reset-password",
    });
    expect(reset.status).toBe(200);
    expect(output()).toContain('"body":"auth.mail_not_sent"');
    expect(output()).toMatch(
      /"app.auth.link":"http:\/\/localhost:4321\/api\/auth\/reset-password\/[^"]+"/
    );
  });

  // request-password-reset is rate limited to 3 a minute, so one deployed environment
  // here; the unit test covers develop, staging and an unset APP_ENV.
  it.each(["production"])(
    "in %s never logs a link and refuses with a clear error, registered or not",
    async (appEnv) => {
      const deployed = withoutEmail(appEnv);
      const signUp = await post(deployed, "/sign-up/email", {
        name: "Ada Lovelace",
        email: `ada.${appEnv}@example.test`,
        password: "test-password-1234",
      });
      expect(signUp.status).toBe(200);

      const output = consoleOutput();
      for (const email of [
        `ada.${appEnv}@example.test`,
        "nobody@example.test",
      ]) {
        const reset = await post(deployed, "/request-password-reset", {
          email,
          redirectTo: "/reset-password",
        });
        expect(reset.status).toBe(412);
        expect(await reset.json()).toMatchObject({
          code: "EMAIL_NOT_CONFIGURED",
          message: EMAIL_NOT_CONFIGURED_MESSAGE,
        });
      }
      const verify = await post(deployed, "/send-verification-email", {
        email: `ada.${appEnv}@example.test`,
      });
      expect(verify.status).toBe(412);
      expect(output()).not.toMatch(
        /reset-password\/|verify-email|"app.auth.link"/
      );
    }
  );
});
