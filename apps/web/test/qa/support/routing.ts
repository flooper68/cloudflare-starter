import { readFileSync } from "node:fs";
import type { BrowserContext, Route } from "@playwright/test";

import { qaEnv } from "./env";
import { authPolicies, takeSlots } from "./limits";

/** The header of the QA bypass (QA_TOKEN_HEADER in packages/features). */
export const QA_TOKEN_HEADER = "x-qa-token";

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js*";
const stub = readFileSync(
  new URL("./turnstile-stub.js", import.meta.url),
  "utf8"
);
const installed = new WeakSet<BrowserContext>();

/**
 * Whether `url` is on the app's origin exactly (scheme, host and port): only those
 * requests get the QA token. Third parties (Cloudflare's challenge, R2 presigned URLs,
 * anything a page links) never see it.
 */
export function isAppRequest(url: string, appOrigin: string): boolean {
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

/**
 * Prepares a browser context for the QA suite, once: X-QA-Token on every request to the
 * app's origin and on nothing else, and the Turnstile script replaced by a stub that hands
 * the forms a placeholder token (the bypass skips the server check for QA addresses).
 * Every /api/auth/* request first takes its rate-limit slots (limits.ts) as it is sent,
 * so the run's count is the server's, whichever context or helper sends it.
 */
export async function installQaRouting(context: BrowserContext): Promise<void> {
  if (installed.has(context)) return;
  installed.add(context);
  const env = qaEnv();
  await context.route(TURNSTILE_SCRIPT, (route) =>
    route.fulfill({ contentType: "application/javascript", body: stub })
  );
  await context.route(
    (url) => isAppRequest(url.href, env.baseURL),
    async (route: Route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.startsWith("/api/auth/")) {
        await takeSlots(authPolicies(pathname.slice("/api/auth".length)));
      }
      await route.fallback({
        headers: {
          ...route.request().headers(),
          [QA_TOKEN_HEADER]: env.token,
        },
      });
    }
  );
}
