/**
 * The QA admin: the account of the nightly cleanup (QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD;
 * docs/guides/how-to-qa-a-deployment.md#nightly-cleanup), an address in the QA domain
 * with the platform admin role and no second factor, set up once by the owner. The admin
 * journeys sign in as it and act only on the run's own accounts and workspaces. Without
 * the two variables, or while the account is not an admin, they skip with the reason.
 */
import type { Page } from "@playwright/test";

import { qaEnv } from "./index";
import { type Account, AUTH_WAIT, submitSignIn } from "./session";

export function qaAdminAccount(): Account | null {
  const email = process.env.QA_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.QA_ADMIN_PASSWORD ?? "";
  return email && password ? { email, password } : null;
}

export const QA_ADMIN_SKIP =
  "the QA admin is not set up: set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD, and make that account a platform admin once (docs/guides/how-to-qa-a-deployment.md#nightly-cleanup)";

/** Signs the QA admin in on `page`; false when it is not set up or not an admin. */
export async function signInQaAdmin(page: Page): Promise<boolean> {
  const account = qaAdminAccount();
  if (!account?.email.endsWith(`@${qaEnv().emailDomain}`)) {
    return false;
  }
  await submitSignIn(page, account.email, account.password);
  const landed = await page
    .waitForURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT })
    .then(() => true)
    .catch(() => false);
  if (!landed) return false;
  const portal = await page.goto("/admin/overview");
  return portal?.status() === 200;
}
