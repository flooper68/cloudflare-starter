/**
 * What the checklist journeys add on top of the QA suite's `qaTest` (index.ts):
 *
 * - `test`: `qaTest` whose default context also paces every /api/auth/* request to the
 *   app's per-IP limits (limits.ts), so a run never trips a 429 on the shared deployment;
 * - `newUserPage(browser)`: a second person's browser (signed out), with the same QA
 *   routing (`installQaRouting`) and pacing;
 * - `newQaAccount(page, { role })`: `createVerifiedAccount` once a sign-up slot is free
 *   (the helper waits 30 s for the form's answer, less than a paced request may wait);
 * - `skipWithoutQaEnv()`: the file-level skip with the suite's reason.
 */
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "@playwright/test";

import {
  createVerifiedAccount,
  expect,
  installQaRouting,
  type QaAccount,
  qaEnv,
  qaSkipReason,
  qaTest,
} from "./index";
import { authPolicies, takeSlots } from "./limits";

export type { Page };
export { expect };

const paced = new WeakSet<BrowserContext>();

/** Every /api/auth/* request of the context first takes its rate-limit slots. */
export async function paceAuth(context: BrowserContext): Promise<void> {
  if (paced.has(context)) return;
  paced.add(context);
  const { baseURL } = qaEnv();
  await context.route(
    // Sign-ups take their slot before the form is sent (newQaAccount, takeSignUpSlot).
    (url) =>
      url.origin === baseURL &&
      url.pathname.startsWith("/api/auth/") &&
      !url.pathname.startsWith("/api/auth/sign-up/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await takeSlots(authPolicies(path.slice("/api/auth".length)));
      await route.fallback();
    }
  );
}

/** A page in a new, signed-out browser context: a second person's browser. */
export async function newUserPage(
  browser: Browser,
  options: BrowserContextOptions = {}
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: qaEnv().baseURL,
    storageState: { cookies: [], origins: [] },
    ...options,
  });
  await installQaRouting(context);
  await paceAuth(context);
  return context.newPage();
}

export const test = qaTest.extend({
  context: async ({ context }, use) => {
    await paceAuth(context);
    await use(context);
  },
});

/** Skips the file, with the suite's reason, when the QA environment is not set. */
export function skipWithoutQaEnv(): void {
  const reason = qaSkipReason();
  test.skip(reason !== null, reason ?? "");
}

/** Waits for a sign-up slot (limits.ts); call it right before a sign-up form is sent. */
export async function takeSignUpSlot(): Promise<void> {
  await takeSlots(authPolicies("/sign-up/email"));
}

/** `createVerifiedAccount` once the run may sign up again. */
export async function newQaAccount(
  page: Page,
  options: { readonly role: string }
): Promise<QaAccount> {
  await takeSignUpSlot();
  return createVerifiedAccount(page, options);
}
