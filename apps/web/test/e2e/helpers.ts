import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/**
 * A fresh account per call: unique per run, so runs never collide in the persistent
 * local D1. Sign-up allows 5 per minute per IP (auth.sign-up in the abuse catalog) and the
 * suite signs up five users per run (the shared one in auth.setup.ts, the admin and member
 * in admin.setup.ts, the journey in auth.spec.ts and the invitee in workspaces.spec.ts),
 * so one run a minute fits and there is no room for more. Reuse the shared session
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

const configuredPages = new WeakSet<Page>();
const localWidget = readFileSync(
  new URL("./turnstile-widget.js", import.meta.url),
  "utf8"
);

/**
 * Opens a page and waits until its React islands have hydrated (Astro drops the `ssr`
 * attribute then); a form submitted earlier would post natively instead of through JS.
 */
export async function open(page: Page, path: string) {
  if (!configuredPages.has(page)) {
    await page.route(
      "https://challenges.cloudflare.com/turnstile/v0/api.js*",
      (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: localWidget,
        })
    );
    configuredPages.add(page);
  }
  await page.goto(path);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

/**
 * Where auth.setup.ts saves the shared user's session: inside Playwright's output folder,
 * which is gitignored and emptied at the start of every run.
 */
export const sharedSession = "test-results/.auth/user.json";

/** Where admin.setup.ts saves the admin journeys' accounts (an admin and a member). */
export const adminAccounts = "test-results/.auth/admin-accounts.json";

/** The accounts admin.setup.ts created. */
export function readAdminAccounts(): {
  readonly admin: Account;
  readonly member: Account;
} {
  return JSON.parse(readFileSync(adminAccounts, "utf8"));
}

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
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

/** Opens the profile menu (the avatar and name in the sidebar footer). */
export async function openProfileMenu(page: Page) {
  await page.getByRole("button", { name: /profile menu$/ }).click();
  return page.getByRole("menu");
}

export async function signOut(page: Page) {
  await openProfileMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * The newest mail the local `send_email` simulation wrote that mentions `text`. Miniflare
 * stores each message's text part under .wrangler/tmp/email/<instance>/email-text/.
 */
export function latestMailMentioning(text: string): string {
  const mail = newestMails().find((body) => body.includes(text));
  if (!mail) throw new Error(`no mail mentions ${text}`);
  return mail;
}

/** Every mail's text part, newest first. */
function newestMails(): string[] {
  const root = join(process.cwd(), ".wrangler/tmp/email");
  return readdirSync(root)
    .flatMap((instance) => {
      const dir = join(root, instance, "email-text");
      try {
        return readdirSync(dir).map((name) => join(dir, name));
      } catch {
        return [];
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((file) => readFileSync(file, "utf8"));
}

/**
 * The newest email verification link sent to `email`. The mail's text names no
 * recipient; the link's token is a JWT whose payload carries the address.
 */
export function latestVerificationLink(email: string): string {
  for (const mail of newestMails()) {
    const link = /https?:\/\/\S+\/api\/auth\/verify-email\?\S+/.exec(mail)?.[0];
    const token = link ? new URL(link).searchParams.get("token") : null;
    const payload = token?.split(".")[1];
    if (!payload) continue;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (claims.email === email) return link as string;
  }
  throw new Error(`no verification link for ${email}`);
}
