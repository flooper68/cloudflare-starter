import { type Browser, expect, type Page } from "@playwright/test";

import { currentRunId, qaAddress } from "./address";
import { callApp, open, signIn, waitForForm } from "./app";
import { type QaEnv, qaEnv } from "./env";
import { inbox } from "./inbox";
import { linkTo } from "./links";
import { qaPassword } from "./password";
import { registerAccount, runAccounts } from "./registry";
import { installQaRouting, QA_TOKEN_HEADER } from "./routing";

export interface QaAccount {
  readonly email: string;
  /** Generated in code (password.ts); never log it or put it in an assertion message. */
  readonly password: string;
}

/** The subject of Better Auth's verification mail (server/auth.ts). */
const VERIFY_SUBJECT = "Verify your email";
/** Clock skew allowance between this machine and the app. */
const SKEW_MS = 30_000;

/**
 * Signs up `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>` through the real sign-up form with a
 * generated password, waits for the verification mail in the QA outbox, opens its link
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
  const submit = page.getByRole("button", { name: "Create account" });
  await waitForForm(submit);
  await page.getByLabel("Name").fill(`QA ${runId} ${options.role}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submit.click();
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
 * Erases every account `runId` created, of any worker or an earlier process, through the
 * app's QA cleanup endpoint (POST /api/qa/cleanup with the QA token): the real erasure,
 * no admin and no browser. It erases only that run's `qa+<runId>-<role>@` accounts (shared
 * workspaces that only they use go with them) and clears their QA outbox mail. Accounts
 * a journey erased already count as `gone`; what the endpoint could not erase now (a
 * workspace someone else still uses, or more than one batch) is reported in
 * `leftForNightly`, for the nightly cleanup, and does not fail the run. Any other failure
 * throws.
 */
export async function cleanupRun(runId: string): Promise<{
  readonly erased: readonly string[];
  readonly gone: readonly string[];
  readonly leftForNightly: readonly string[];
}> {
  const env = qaEnv();
  const emails = runAccounts(runId);
  const erased: string[] = [];
  let remaining: readonly string[] = [];
  // The endpoint erases at most a batch per call: call until it is done or stuck.
  for (let call = 0; call < 10; call++) {
    const result = await qaCleanup(env, { runId });
    erased.push(...result.erased);
    remaining = result.remaining;
    if (result.erased.length === 0) break;
  }
  for (const email of emails) await inbox.clear(email).catch(() => 0);
  const gone = emails.filter(
    (email) => !erased.includes(email) && !remaining.includes(email)
  );
  if (remaining.length > 0) {
    console.warn(
      `QA cleanup: ${remaining.length} account(s) left for the nightly cleanup: ${remaining.join(", ")}`
    );
  }
  return { erased, gone, leftForNightly: remaining };
}

/** POST /api/qa/cleanup: `{ runId }` for one run, `{}` for every run account over 2 h old. */
export async function qaCleanup(
  env: QaEnv,
  body: { readonly runId?: string }
): Promise<{
  readonly erased: readonly string[];
  readonly remaining: readonly string[];
}> {
  const response = await fetch(`${env.baseURL}/api/qa/cleanup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [QA_TOKEN_HEADER]: env.token,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `QA cleanup answered ${response.status}${response.status === 404 ? " (QA_BYPASS is off for this environment)" : ""}`
    );
  }
  return response.json() as Promise<{
    erased: readonly string[];
    remaining: readonly string[];
  }>;
}
