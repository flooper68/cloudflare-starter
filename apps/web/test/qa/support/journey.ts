/**
 * What the checklist journeys add on top of the QA suite's `qaTest` (index.ts):
 *
 * - `test`: `qaTest`; like every QA context, its /api/auth/* requests take their slots of
 *   the app's per-IP limits as they are sent (routing.ts, limits.ts), so a run never trips
 *   a 429 on the shared deployment;
 * - `newUserPage(browser)`: a second person's browser (signed out), with the same QA
 *   routing (`installQaRouting`);
 * - `newQaAccount(page, { role })`: `createVerifiedAccount`, which waits for a free
 *   sign-up slot before the form;
 * - `skipWithoutQaEnv()`: the file-level skip with the suite's reason.
 */
import type { Browser, BrowserContextOptions, Page } from "@playwright/test";

import {
  createVerifiedAccount,
  expect,
  installQaRouting,
  type QaAccount,
  qaEnv,
  qaSkipReason,
  qaTest,
} from "./index";
import { authPolicies, waitForSlots } from "./limits";

export type { Page };
export { expect };

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
  return context.newPage();
}

export const test = qaTest;

/** Skips the file, with the suite's reason, when the QA environment is not set. */
export function skipWithoutQaEnv(): void {
  const reason = qaSkipReason();
  test.skip(reason !== null, reason ?? "");
}

/**
 * Waits until a sign-up could go (limits.ts); call it right before a sign-up form is sent.
 * The request itself takes the slot (routing.ts).
 */
export async function takeSignUpSlot(): Promise<void> {
  await waitForSlots(authPolicies("/sign-up/email"));
}

/** `createVerifiedAccount` once the run may sign up again. */
export async function newQaAccount(
  page: Page,
  options: { readonly role: string }
): Promise<QaAccount> {
  return createVerifiedAccount(page, options);
}
