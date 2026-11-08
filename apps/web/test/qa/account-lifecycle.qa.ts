/**
 * The example journey that proves the QA chain end to end against a deployed app: sign up
 * through the real form (QA bypass instead of Turnstile), the verification mail in the QA
 * inbox, its link, the dashboard, and erasure through Settings › Privacy. Skips with the
 * reason when the QA environment variables are not set. The run's global teardown erases
 * whatever a failed journey left (cleanupRun).
 */
import {
  createVerifiedAccount,
  eraseQaAccount,
  expect,
  inbox,
  open,
  qaSkipReason,
  qaTest,
} from "./support";

qaTest.skip(qaSkipReason() !== null, qaSkipReason() ?? "");

qaTest(
  "sign up, verify by mail, open the dashboard, erase the account",
  async ({ browser, page }) => {
    const startedAt = new Date(Date.now() - 30_000);
    const account = await createVerifiedAccount(page, { role: "lifecycle" });

    await open(page, "/app/dashboard");
    await expect(page.getByText("Get started").first()).toBeVisible();
    await expect(page.getByText("Verify your email").first()).toBeVisible();

    // The real erasure flow (Settings › Privacy › Delete account) in a context of its own.
    expect(await eraseQaAccount(browser, account)).toBe(true);

    // The erasure mail arrives, and the old credentials no longer sign in.
    const goodbye = await inbox.waitFor({
      to: account.email,
      subject: "Your account was deleted",
      since: startedAt,
    });
    expect(goodbye.from).toMatch(/@/);
    await open(page, "/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await inbox.clear(account.email);
  }
);
