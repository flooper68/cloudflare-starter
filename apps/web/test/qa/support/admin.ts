/**
 * The persistent QA admin, `qa-admin@<emailDomain>`: not run-scoped, so `cleanupRun`
 * never erases it. Its password is derived from the QA token (HMAC, never stored or
 * logged), so every run can sign in without a stored secret; whoever holds the token
 * and the inbox can already take the account over through a password reset, so this
 * grants nothing more. The first run signs it up and verifies it through the inbox; after
 * a token rotation the run resets the password through the inbox.
 *
 * It is a platform admin only after the owner's one-time step (README.md, "QA admin"):
 * production's bootstrap admin is the owner's own account, and the suite never promotes
 * anyone. Until then the admin journeys skip with that reason.
 */
import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";

import { qaEnv } from "./env";
import { expect } from "./fixture";
import { inbox } from "./inbox";
import { withRunLock } from "./limits";
import { type Account, open, submitSignIn } from "./session";

export function qaAdminAddress(): string {
  return `qa-admin@${qaEnv().emailDomain}`;
}

function qaAdminPassword(): string {
  const digest = createHmac("sha256", qaEnv().qaToken)
    .update(`cloudflare-starter qa-admin ${qaAdminAddress()}`)
    .digest("base64url");
  return `${digest.slice(0, 32)}-Qa1`;
}

export const QA_ADMIN_SKIP =
  "the QA admin (qa-admin@<emailDomain>) is not a platform admin yet: the owner promotes it once, see apps/web/test/qa/README.md (QA admin)";

async function signedIn(page: Page): Promise<boolean> {
  return /\/app\/dashboard$/.test(page.url());
}

/** Signs the QA admin in on `page`, creating or repairing the account if needed. */
async function signInQaAdmin(page: Page): Promise<Account> {
  const account = { email: qaAdminAddress(), password: qaAdminPassword() };
  await submitSignIn(page, account.email, account.password);
  await page
    .waitForURL(/\/app\/dashboard$|\/two-factor/, { timeout: 15_000 })
    .catch(() => undefined);
  if (await signedIn(page)) return account;
  if (/\/two-factor/.test(page.url())) {
    throw new Error(
      "the QA admin has a second factor; the suite cannot sign it in"
    );
  }

  // Refused: either the account does not exist yet or its password predates this token.
  const since = Date.now();
  await open(page, "/forgot-password");
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
  const reset = await inbox
    .waitFor({
      to: account.email,
      subject: "Reset your password",
      since,
      timeoutMs: 30_000,
    })
    .catch(() => null);
  if (reset) {
    const link = reset.links.find((href) => href.includes("reset-password"));
    if (!link) throw new Error("the reset mail has no link");
    await page.goto(link);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    await page
      .getByLabel("New password", { exact: true })
      .fill(account.password);
    await page.getByLabel("Confirm new password").fill(account.password);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  } else {
    const signUp = Date.now();
    await open(page, "/sign-up");
    await page.getByLabel("Name").fill("QA admin");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Create account" }).click();
    const verify = await inbox.waitFor({
      to: account.email,
      subject: "Verify your email",
      since: signUp,
      timeoutMs: 60_000,
    });
    const link = verify.links.find((href) => href.includes("verify-email"));
    if (!link) throw new Error("the verification mail has no link");
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "Email verified" })
    ).toBeVisible();
  }
  await submitSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  return account;
}

/**
 * Signs the QA admin in and reports whether it may use the portal. One worker at a time
 * (two files may need it at once, and only one may create or repair it).
 */
export async function qaAdmin(
  page: Page
): Promise<{ readonly account: Account; readonly isAdmin: boolean }> {
  const account = await withRunLock("qa-admin", () => signInQaAdmin(page));
  const portal = await page.request.get("/admin/overview", {
    headers: { "x-qa-token": qaEnv().qaToken },
  });
  return { account, isAdmin: portal.status() === 200 };
}
