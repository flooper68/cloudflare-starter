import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { GET as trpcGet } from "@/pages/api/trpc/[...trpc]";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";
import { getAuth } from "@/server/auth";

import { APP_URL, env, signUpRequest } from "./helpers";

// A browser that still holds the session of an account that was erased or suspended
// (its sessions deleted) is signed out: pages render signed out or redirect to /sign-in,
// APIs answer 401, and the answers expire the stale session cookies. Both with the
// one-minute session cookie cache still in the browser and after it ran out (only the
// session token left), so the outcome never depends on the cache.

/** Signs up and keeps every cookie the browser would (the token and the cookie cache). */
async function signedUp(email: string) {
  const response = await signUpRequest("Stale Session", email);
  expect(response.ok).toBe(true);
  const body = (await response.json()) as { user: { id: string } };
  const cookies = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="));
  expect(cookies.some((pair) => pair.includes("session_data"))).toBe(true);
  return { id: body.user.id, cookies };
}

async function erase(userId: string) {
  const auth = getAuth(env);
  await auth.withErasureOperation(crypto.randomUUID(), async () => {
    await (await auth.$context).internalAdapter.deleteUser(userId);
  });
}

/** What an admin suspension does (admin-auth-gateway.ts: ban, then revoke sessions). */
async function suspend(userId: string) {
  const internal = (await getAuth(env).$context).internalAdapter;
  await internal.updateUser(userId, { banned: true, banReason: "test" });
  await internal.deleteUserSessions(userId);
}

function middlewareContext(path: string, cookie: string) {
  const request = new Request(`${APP_URL}${path}`, { headers: { cookie } });
  return {
    request,
    url: new URL(request.url),
    isPrerendered: false,
    locals: {} as MiddlewareContext["locals"],
    redirect: (to: string) =>
      new Response(null, { status: 302, headers: { location: to } }),
  } satisfies MiddlewareContext;
}

/** The names of the cookies the response expires (Max-Age=0). */
function expiredCookies(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((line) => /max-age=0/i.test(line))
    .map((line) => line.split("=")[0] ?? "");
}

const expiresTheToken = expect.arrayContaining([
  expect.stringContaining("session_token"),
]);

const CASES = [
  { account: "an erased account", end: erase },
  { account: "a suspended account", end: suspend },
] as const;
const CACHE = [
  { label: "with the session cookie cache", cached: true },
  { label: "after the cookie cache ran out", cached: false },
] as const;

let counter = 0;

describe.each(CASES)("the session of $account", ({ end }) => {
  describe.each(CACHE)("$label", ({ cached }) => {
    async function staleCookie() {
      counter += 1;
      const user = await signedUp(`stale-session-${counter}@example.test`);
      await end(user.id);
      return user.cookies
        .filter((pair) => cached || pair.includes("session_token"))
        .join("; ");
    }

    it("/sign-in renders signed out and expires the session cookies", async () => {
      const context = middlewareContext("/sign-in", await staleCookie());
      const response = await handleAppRequest(
        context,
        env,
        async () => new Response("sign-in page")
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("sign-in page");
      expect(context.locals.user).toBeNull();
      expect(expiredCookies(response)).toEqual(expiresTheToken);
    });

    it("/app/dashboard redirects to /sign-in and expires the session cookies", async () => {
      const response = await handleAppRequest(
        middlewareContext("/app/dashboard", await staleCookie()),
        env,
        async () => new Response("never")
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/sign-in");
      expect(expiredCookies(response)).toEqual(expiresTheToken);
    });

    it("the tRPC API answers 401 and leaves the cookies to the next page load", async () => {
      const context = middlewareContext(
        "/api/trpc/workspace.list",
        await staleCookie()
      );
      const response = await handleAppRequest(context, env, async () =>
        trpcGet({ ...context, params: {} } as unknown as APIContext)
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as {
        error: { data: { code: string } };
      };
      expect(body.error.data.code).toBe("UNAUTHORIZED");
      // An API call can answer after the browser got a new session (stop impersonating):
      // expiring cookies there would sign that new session out.
      expect(expiredCookies(response)).toEqual([]);
    });

    it("Better Auth's /get-session answers null and expires the session cookies", async () => {
      const response = await getAuth(env).handler(
        new Request(`${APP_URL}/api/auth/get-session`, {
          headers: { cookie: await staleCookie() },
        })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
      expect(expiredCookies(response)).toEqual(expiresTheToken);
    });
  });
});
