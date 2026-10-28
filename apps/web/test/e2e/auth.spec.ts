import { expect, type Page, test } from "@playwright/test";

import { newAccount, open, signIn, signOut, signUp } from "./helpers";

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
    page.getByRole("heading", { name: "Starter app" })
  ).toBeVisible();
  await page.getByRole("button", { name: /workspace menu/ }).click();
  await expect(page.getByRole("menu")).toContainText(account.email);
  await page.keyboard.press("Escape");
});

test("the profile shows the signed-in account", async () => {
  await page.getByRole("link", { name: "Profile" }).first().click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Account settings" })
  ).toBeVisible();
  await expect(page.getByText(account.email).first()).toBeVisible();
  await expect(
    page.getByText(account.name, { exact: true }).first()
  ).toBeVisible();
});

test("the profile changes the password", async () => {
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
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);

  await signIn(page, { email: account.email, password: newPassword });
  await expect(
    page.getByRole("heading", { name: "Starter app" })
  ).toBeVisible();
});
