/**
 * The `test` every QA journey imports: `qaTest` (the E2E fixture with its CSP guard,
 * X-QA-Token and `runId`) plus what a run against a shared deployment needs on every
 * browser context, the default one and those a journey opens for a second person:
 *
 * - X-QA-Token on app-origin requests only (the same header `qaTest` adds; setting it
 *   twice is harmless), so contexts opened with `newUserPage` get it too;
 * - every /api/auth/* request first takes its rate-limit slots (limits.ts);
 * - Turnstile's script is answered with a widget that hands the form a placeholder
 *   token at once. The server still checks the token: locally against the Siteverify
 *   simulation (E2E_LOCAL_TURNSTILE=1), on a deployment it is skipped only for requests
 *   that carry the QA token. No CAPTCHA is ever solved.
 */
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test";

import { qaEnv } from "./env";
import { expect, qaTest } from "./fixture";
import { hasQaEnv } from "./global";
import { authPolicies, takeSlots } from "./limits";

export type { Page };
export { expect };

const WIDGET = `(() => {
  const widgets = new Map();
  let sequence = 0;
  const pass = (id) => setTimeout(() => widgets.get(id)?.callback?.("XXXX.DUMMY.TOKEN.XXXX"), 0);
  window.turnstile = {
    render(container, options) {
      const id = "qa-" + ++sequence;
      widgets.set(id, options);
      container.textContent = "Human check (QA run)";
      pass(id);
      return id;
    },
    reset(id) { pass(id); },
    remove(id) { widgets.delete(id); },
  };
})();`;

const prepared = new WeakSet<BrowserContext>();

/** Applies the QA run's request handling to a browser context (once). */
export async function prepareContext(context: BrowserContext): Promise<void> {
  if (prepared.has(context)) return;
  prepared.add(context);
  const { baseUrl, qaToken } = qaEnv();
  await context.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) =>
      route.fulfill({ contentType: "application/javascript", body: WIDGET })
  );
  await context.route(
    (url) => url.origin === baseUrl,
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith("/api/auth/")) {
        await takeSlots(authPolicies(path.slice("/api/auth".length)));
      }
      await route.fallback({
        headers: { ...route.request().headers(), "x-qa-token": qaToken },
      });
    }
  );
}

/** A page in a new, signed-out browser context: a second person's browser. */
export async function newUserPage(
  browser: Browser,
  options: BrowserContextOptions = {}
): Promise<Page> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    ...options,
  });
  await prepareContext(context);
  return context.newPage();
}

export const test = qaTest.extend({
  context: async ({ context }, use) => {
    await prepareContext(context);
    await use(context);
  },
});

/** Skips the file, with the reason, when the QA environment variables are missing. */
export function skipWithoutQaEnv(): void {
  test.skip(
    !hasQaEnv(),
    "QA environment not set (QA_BASE_URL, QA_TOKEN, QA_INBOX_URL, QA_INBOX_TOKEN, QA_EMAIL_DOMAIN): see apps/web/test/qa/README.md"
  );
}
