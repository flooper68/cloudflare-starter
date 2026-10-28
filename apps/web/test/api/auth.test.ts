import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { getAuth } from "@/server/auth";

import { APP_URL, humanHeaders, signUp } from "./helpers";

const json = (path: string, body: unknown, cookie?: string) =>
  getAuth(env).handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        ...humanHeaders(),
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );

describe("Better Auth (real D1)", () => {
  it("signs up, reads the session, signs out and signs in again", async () => {
    const user = await signUp("Nicole Example", "nicole@example.test");
    const session = await getAuth(env).handler(
      new Request(`${APP_URL}/api/auth/get-session`, {
        headers: { cookie: user.cookie },
      })
    );
    expect(
      ((await session.json()) as { user: { email: string } }).user.email
    ).toBe("nicole@example.test");

    expect((await json("/sign-out", {}, user.cookie)).status).toBe(200);
    const signIn = await json("/sign-in/email", {
      email: "nicole@example.test",
      password: "test-password-1234",
    });
    expect(signIn.status).toBe(200);
  });

  it("rejects a wrong password and a duplicate email", async () => {
    await signUp("Ada Lovelace", "ada@example.test");
    expect(
      (
        await json("/sign-in/email", {
          email: "ada@example.test",
          password: "wrong-password-0",
        })
      ).status
    ).toBe(401);
    expect(
      (
        await json("/sign-up/email", {
          name: "Ada Again",
          email: "ada@example.test",
          password: "test-password-1234",
        })
      ).status
    ).toBe(422);
  });
});
