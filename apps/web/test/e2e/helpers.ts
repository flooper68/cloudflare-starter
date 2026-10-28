import { expect, type Page } from "@playwright/test";

/**
 * A fresh account per call: unique per run, so runs never collide in the persistent
 * local D1. Sign-up allows 5 per minute per IP (auth.sign-up in the abuse catalog) and the suite
 * signs up three users per run (the shared one in auth.setup.ts, the journey in
 * auth.spec.ts and the invitee in workspaces.spec.ts), so one run a minute fits. Reuse the shared session
 * (`test.use({ storageState: sharedSession })`) instead of signing up more users.
 */
export function newAccount(label: string) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `E2E ${label}`,
    email: `e2e-${label}-${id}@example.test`,
    password: `Correct-horse-${id}`,
  };
}

export type Account = ReturnType<typeof newAccount>;

/**
 * Opens a page and waits until its React islands have hydrated (Astro drops the `ssr`
 * attribute then); a form submitted earlier would post natively instead of through JS.
 */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

/**
 * Where auth.setup.ts saves the shared user's session: inside Playwright's output folder,
 * which is gitignored and emptied at the start of every run.
 */
export const sharedSession = "test-results/.auth/user.json";

export async function signUp(page: Page, account: Account) {
  await open(page, "/sign-up");
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

export async function signIn(
  page: Page,
  account: Pick<Account, "email" | "password">
) {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /workspace menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}
