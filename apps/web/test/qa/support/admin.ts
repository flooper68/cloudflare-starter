/**
 * The QA admin: `qa+admin@<emailDomain>`, self-provisioned like every QA account (its
 * password is derived from the QA token, support/password.ts), and promoted by the app
 * while the QA bypass is on. The admin journeys sign in as it and act only on the run's
 * own accounts and workspaces; there is no owner step and no skip.
 *
 * Interim: the QA infrastructure PR that introduces the self-provisioned admin provides
 * the canonical `signInQaAdmin(page)`; once it is on main this file re-exports it.
 */
import type { Page } from "@playwright/test";

import { expect, inbox, linkTo, open, qaEnv } from "./index";
import { takeSignUpSlot } from "./journey";
import { qaPassword } from "./password";
import { type Account, AUTH_WAIT, submitSignIn } from "./session";

export function qaAdminAccount(): Account {
  const { emailDomain, token } = qaEnv();
  const email = `qa+admin@${emailDomain}`;
  return { email, password: qaPassword(email, token) };
}

/** True on the dashboard, false once the form shows a refusal. */
async function landed(page: Page): Promise<boolean> {
  const refused = page.getByText(/invalid email or password/i);
  await expect
    .poll(
      async () =>
        /\/app\/dashboard$/.test(page.url()) || (await refused.isVisible()),
      { timeout: AUTH_WAIT }
    )
    .toBe(true);
  return /\/app\/dashboard$/.test(page.url());
}

/**
 * Signs the QA admin in on `page`, signing it up first if it does not exist yet, and
 * checks it may open the admin portal. Throws when it cannot: a missing admin is a
 * failure of the environment, not a reason to skip.
 */
export async function signInQaAdmin(page: Page): Promise<Account> {
  const account = qaAdminAccount();
  await submitSignIn(page, account.email, account.password);
  if (!(await landed(page))) {
    const since = new Date(Date.now() - 30_000);
    await open(page, "/sign-up");
    await page.getByLabel("Name").fill("QA admin");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await takeSignUpSlot();
    await page.getByRole("button", { name: "Create account" }).click();
    const mail = await inbox.waitFor({
      to: account.email,
      subject: "Verify your email",
      since,
      timeoutMs: 120_000,
    });
    await page.goto(
      linkTo(mail.links, qaEnv().baseURL, "/api/auth/verify-email")
    );
    await submitSignIn(page, account.email, account.password);
    expect(await landed(page), "the QA admin signs in").toBe(true);
  }
  const portal = await page.goto("/admin/overview");
  expect(
    portal?.status(),
    "the QA admin may open the admin portal (the app promotes it while QA_BYPASS is on)"
  ).toBe(200);
  return account;
}
