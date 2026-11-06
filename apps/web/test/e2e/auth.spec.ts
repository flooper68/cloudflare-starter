import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

import {
  latestVerificationLink,
  newAccount,
  open,
  signIn,
  signOut,
  signUp,
} from "./helpers";

// One account walks through its whole life: sign up, profile, password change, sign out,
// sign in. Serial and on one page, so the suite signs up only once here (sign-up is rate
// limited, see helpers.ts); a failure skips the steps after it.
test.describe.configure({ mode: "serial" });

const account = newAccount("journey");
const newPassword = `${account.password}-new`;
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test("sign up lands on the dashboard", async () => {
  await signUp(page, account);
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible();
  await page.getByRole("button", { name: /workspace menu/ }).click();
  await expect(page.getByRole("menu")).toContainText(account.email);
  await page.keyboard.press("Escape");
});

test("verify email: the checklist, check your inbox, resend, the link, email verified", async () => {
  // Locally AUTH_REQUIRE_EMAIL_VERIFICATION=false: sign-up signs in at once and the
  // address stays unverified until the link is opened.
  const checklist = page.getByRole("list", { name: "Get started" });
  await expect(checklist).toContainText("Verify your email (to do)");
  await checklist.getByRole("link", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(
    page.getByRole("heading", { name: "Check your inbox" })
  ).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.getByRole("button", { name: "Resend link" }).click();
  await expect(
    page.getByText("Sent. Check your inbox again in a minute.")
  ).toBeVisible();

  // The newest mail to this address carries the link; it lands on /email-verified.
  const url = new URL(latestVerificationLink(account.email));
  await page.goto(`${url.pathname}${url.search}`);
  await expect(page).toHaveURL(/\/email-verified$/);
  await expect(
    page.getByRole("heading", { name: "Email verified" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to the app" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(checklist).toContainText("Verify your email (done)");

  // A used or broken link says so and offers a new one.
  await page.goto("/email-verified?error=INVALID_TOKEN");
  await expect(
    page.getByRole("heading", { name: "This link doesn't work" })
  ).toBeVisible();
  await page.goto("/app/dashboard");
});

test("the profile shows the signed-in account", async () => {
  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(
    page.getByRole("heading", { name: "Account settings" })
  ).toBeVisible();
  await expect(page.getByText(account.email).first()).toBeVisible();
  await expect(
    page.getByText(account.name, { exact: true }).first()
  ).toBeVisible();
});

test("security settings revokes another browser session", async () => {
  const browser = page.context().browser();
  if (!browser) throw new Error("Browser unavailable");
  const other = await browser.newPage();
  try {
    await signIn(other, account);
    await open(page, "/app/settings/security");
    await page
      .getByRole("button", { name: "Sign out session", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign out session", exact: true })
    ).toHaveCount(0);
    const result = await other.request.get(
      "/api/auth/get-session?disableCookieCache=true"
    );
    expect(await result.json()).toBeNull();
  } finally {
    await other.close();
  }
});

test("security settings changes the password", async () => {
  await page.getByRole("link", { name: "Security", exact: true }).click();
  const update = page.getByRole("button", { name: "Update password" });
  await page.getByLabel("Current password").fill(account.password);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill("something-else");
  await update.click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();

  await page.getByLabel("Confirm new password").fill(newPassword);
  await update.click();
  await expect(page.getByText(/Password updated/)).toBeVisible();
});

test("sign out ends the session", async () => {
  await signOut(page);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("sign in takes the new password, not the old one", async () => {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);

  await signIn(page, { email: account.email, password: newPassword });
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible();
});

test("privacy export finishes, notifies and downloads a valid archive", async () => {
  await open(page, "/app/settings/privacy");
  await page.getByRole("button", { name: "Request personal export" }).click();
  await expect(page.getByText("Data export queued")).toBeVisible();
  await expect
    .poll(
      async () => {
        await page.getByRole("button", { name: "Refresh exports" }).click();
        return page
          .getByRole("button", { name: "Download", exact: true })
          .count();
      },
      { timeout: 60000 }
    )
    .toBe(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("No archive path");
  expect(readFileSync(path).subarray(0, 2).toString()).toBe("PK");
  const checked = spawnSync("python3", [
    "-c",
    "import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert 'manifest.json' in z.namelist(); assert json.loads(z.read('manifest.json'))['format']==1; assert any(n.startswith('data/user/') for n in z.namelist())",
    path,
  ]);
  expect(checked.status, checked.stderr.toString()).toBe(0);
  await expect
    .poll(
      async () => {
        await open(page, "/app/notifications");
        const link = page.getByRole("link", {
          name: "Your data export is ready",
          exact: true,
        });
        // Hydration precedes the inbox query; wait for this render before reloading.
        await link
          .waitFor({ state: "visible", timeout: 1000 })
          .catch(() => undefined);
        return link.count();
      },
      { timeout: 30000 }
    )
    .toBe(1);
  const notification = page.getByRole("link", {
    name: "Your data export is ready",
    exact: true,
  });
  await expect(notification).toBeVisible();
  const notificationDownload = page.waitForEvent("download");
  await notification.click();
  const linkedArchive = await (await notificationDownload).path();
  if (!linkedArchive)
    throw new Error("Notification did not deliver an archive");
  expect(readFileSync(linkedArchive).equals(readFileSync(path))).toBe(true);
  await open(page, "/app/settings/privacy");
  await page.getByRole("button", { name: /^Notifications(?:,|$)/ }).click();
  const bell = page.getByRole("dialog", { name: "Notifications", exact: true });
  const bellDownload = page.waitForEvent("download");
  await bell
    .getByRole("link", { name: "Your data export is ready", exact: true })
    .click();
  const bellArchive = await (await bellDownload).path();
  if (!bellArchive)
    throw new Error("Notification bell did not deliver an archive");
  expect(readFileSync(bellArchive).equals(readFileSync(path))).toBe(true);
});

test("privacy settings deletes the account after confirmation", async () => {
  // auth.delete-user allows 3 deletions an hour per IP, fewer than the runs an hour can
  // make. A documentation-range client IP per minute keeps the real limit and gives each
  // run (at most one a minute, see helpers.ts) its own quota.
  const minute = Math.floor(Date.now() / 60_000) % 250;
  await page.setExtraHTTPHeaders({
    "cf-connecting-ip": `203.0.113.${minute + 1}`,
  });
  await open(page, "/app/settings/privacy");
  await page.getByLabel("Confirm your email").fill(account.email);
  await page.getByLabel("Current password").fill(newPassword);
  await page
    .getByRole("button", { name: "Delete account permanently" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/app/settings/account");
  await expect(page).toHaveURL(/\/sign-in/);
});
