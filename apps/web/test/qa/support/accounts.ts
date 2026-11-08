/**
 * STUB: the QA infrastructure PR replaces this file. Contract:
 * `createVerifiedAccount(page, { role })` signs `qa-<runId>-<role>@<emailDomain>` up
 * through the real sign-up form, verifies it through the mail's link (which signs it in)
 * and returns `{ email, password }`. The password is generated here and never logged.
 */
import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

import { qaAddress } from "./env";
import { currentRunId, expect } from "./fixture";
import { inbox } from "./inbox";

export interface QaAccount {
  readonly email: string;
  readonly password: string;
}

/** A fresh password for one account of one run: 24 random characters plus classes. */
export function generatePassword(): string {
  return `${randomBytes(18).toString("base64url")}-Qa1`;
}

export async function createVerifiedAccount(
  page: Page,
  { role }: { readonly role: string }
): Promise<QaAccount> {
  const runId = currentRunId();
  const email = qaAddress(runId, role);
  const password = generatePassword();
  const since = Date.now();

  await page.goto("/sign-up");
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.getByLabel("Name").fill(`QA ${runId} ${role}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // With AUTH_REQUIRE_EMAIL_VERIFICATION=true the form shows "Check your inbox"; without
  // it the sign-up signs in at once. Either way the address is verified by the link.
  await expect(
    page
      .getByRole("heading", { name: "Check your inbox" })
      .or(page.getByRole("heading", { name: /^Welcome, / }))
  ).toBeVisible({ timeout: 180_000 });

  const mail = await inbox.waitFor({
    to: email,
    subject: "Verify your email",
    since,
    timeoutMs: 60_000,
  });
  const link = mail.links.find((href) =>
    href.includes("/api/auth/verify-email")
  );
  if (!link) throw new Error(`the verification mail to ${email} has no link`);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Email verified" })
  ).toBeVisible();
  return { email, password };
}
