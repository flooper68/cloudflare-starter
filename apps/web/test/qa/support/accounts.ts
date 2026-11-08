import { type Browser, chromium, expect, type Page } from "@playwright/test";

import { currentRunId, qaAddress } from "./address";
import { callApp, open, signIn } from "./app";
import { qaEnv } from "./env";
import { inbox } from "./inbox";
import { linkTo } from "./links";
import { qaPassword } from "./password";
import { registerAccount, runAccounts } from "./registry";
import { installQaRouting } from "./routing";

export interface QaAccount {
  readonly email: string;
  /** Generated in code (password.ts); never log it or put it in an assertion message. */
  readonly password: string;
}

/** The subject of Better Auth's verification mail (server/auth.ts). */
const VERIFY_SUBJECT = "Verify your email";
/** Clock skew allowance between this machine and the inbox Worker. */
const SKEW_MS = 30_000;

/**
 * Signs up `qa-<runId>-<role>@<QA_EMAIL_DOMAIN>` through the real sign-up form with a
 * generated password, waits for the verification mail in the QA inbox, opens its link
 * (which must point at QA_BASE_URL) and ends signed in on the dashboard. The account is
 * recorded for `cleanupRun`. The page's context gets the QA routing (X-QA-Token to the app
 * only, the Turnstile stub) if it has not yet.
 */
export async function createVerifiedAccount(
  page: Page,
  options: { readonly role: string; readonly runId?: string }
): Promise<QaAccount> {
  const env = qaEnv();
  const runId = options.runId ?? currentRunId();
  const email = qaAddress(runId, options.role, env.emailDomain);
  const password = qaPassword(email, env.token);
  await installQaRouting(page.context());
  registerAccount(runId, email);

  const since = new Date(Date.now() - SKEW_MS);
  await open(page, "/sign-up");
  await page.getByLabel("Name").fill(`QA ${runId} ${options.role}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // With AUTH_REQUIRE_EMAIL_VERIFICATION=true (production) the form shows the check-inbox
  // card; without it the app opens the dashboard straight away and still sends the mail.
  await expect
    .poll(
      async () =>
        /\/app\/dashboard$/.test(new URL(page.url()).pathname) ||
        (await page
          .getByRole("heading", { name: "Check your inbox" })
          .isVisible()),
      { timeout: 30_000, message: `sign-up of ${email} did not complete` }
    )
    .toBe(true);

  const mail = await inbox.waitFor({
    to: email,
    subject: VERIFY_SUBJECT,
    since,
    timeoutMs: 120_000,
  });
  await page.goto(linkTo(mail.links, env.baseURL, "/api/auth/verify-email"));
  await expect(
    page.getByRole("heading", { name: "Email verified" })
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Continue to the app" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: 30_000 });
  return { email, password };
}

/** Whether the page shows the app's rate-limit notice or a 429 message. */
async function rateLimited(page: Page): Promise<boolean> {
  return page
    .getByText(/too many requests|try again in \d+ seconds/i)
    .first()
    .isVisible()
    .catch(() => false);
}

interface WorkspaceList {
  readonly items: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: "personal" | "shared";
    readonly role: string;
  }[];
}

/**
 * Erases one QA account the way its owner would, in a fresh context of `browser`: signs
 * in, deletes the shared workspaces it owns (erasure refuses while it is the last owner of
 * one with other members), then Settings › Privacy › Delete account with its password.
 * False when the account is gone already (sign-in
 * refused); throws `RATE_LIMITED: …` when erasure is rate limited.
 */
export async function eraseQaAccount(
  browser: Browser,
  account: QaAccount
): Promise<boolean> {
  const context = await browser.newContext({ baseURL: qaEnv().baseURL });
  try {
    await installQaRouting(context);
    const page = await context.newPage();
    try {
      await signIn(page, account);
    } catch (error) {
      if (await rateLimited(page)) throw new Error("RATE_LIMITED: sign-in");
      // Refused credentials: the account was erased already (or never finished).
      if (await page.getByText(/invalid email or password/i).isVisible())
        return false;
      throw error;
    }
    const { items } = await callApp<WorkspaceList>(
      page,
      "query",
      "workspace.list"
    );
    for (const workspace of items) {
      if (workspace.kind !== "shared" || workspace.role !== "owner") continue;
      await callApp(page, "mutation", "workspace.delete", {
        workspaceId: workspace.id,
        confirmName: workspace.name,
      });
    }
    await open(page, "/app/settings/privacy");
    await page.getByLabel("Confirm your email").fill(account.email);
    await page.getByLabel("Current password").fill(account.password);
    await page
      .getByRole("button", { name: "Delete account permanently" })
      .click();
    await expect
      .poll(
        async () => {
          if (new URL(page.url()).pathname === "/") return "erased";
          if (await rateLimited(page)) return "rate-limited";
          return "waiting";
        },
        { timeout: 30_000, message: `erasure of ${account.email}` }
      )
      .not.toBe("waiting");
    if (new URL(page.url()).pathname !== "/") {
      throw new Error("RATE_LIMITED: account erasure (auth.delete-user)");
    }
    return true;
  } finally {
    await context.close();
  }
}

/**
 * Erases every account `runId` created (all workers, recorded by createVerifiedAccount)
 * through the real privacy erasure flow, after deleting the shared workspaces each owns.
 * Accounts already gone are skipped. Erasure is limited to 3 an hour per IP
 * (auth.delete-user): what this cannot erase now, the nightly cleanup job erases later,
 * so a refusal is reported and does not fail the run. Any other failure throws.
 */
export async function cleanupRun(runId: string): Promise<{
  readonly erased: readonly string[];
  readonly gone: readonly string[];
  readonly leftForNightly: readonly string[];
}> {
  const env = qaEnv();
  const emails = runAccounts(runId);
  const erased: string[] = [];
  const gone: string[] = [];
  const leftForNightly: string[] = [];
  const failures: string[] = [];
  if (emails.length === 0) return { erased, gone, leftForNightly };
  const browser = await chromium.launch();
  try {
    for (const email of emails) {
      try {
        const done = await eraseQaAccount(browser, {
          email,
          password: qaPassword(email, env.token),
        });
        (done ? erased : gone).push(email);
        // The inbox would delete it within 24 hours anyway.
        await inbox.clear(email).catch(() => 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/429|too many|RATE_LIMITED/i.test(message))
          leftForNightly.push(email);
        else failures.push(`${email}: ${message.split("\n")[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (leftForNightly.length > 0) {
    console.warn(
      `QA cleanup: ${leftForNightly.length} account(s) left for the nightly cleanup (erasure rate limit): ${leftForNightly.join(", ")}`
    );
  }
  if (failures.length > 0) {
    throw new Error(`QA cleanup failed for:\n${failures.join("\n")}`);
  }
  return { erased, gone, leftForNightly };
}
