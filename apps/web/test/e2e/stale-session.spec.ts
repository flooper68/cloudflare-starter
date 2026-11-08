import { expect, type Page, test } from "./fixtures";
import { newAccount, open, readAdminAccounts, signIn, signUp } from "./helpers";

// A browser that still holds the session of an account that was erased or suspended is
// signed out, not shown an error: /sign-in renders and /app redirects to it, and the
// stale session cookies are expired. Both while the one-minute session cookie cache is
// still in the browser and once it ran out (the cache cookie removed, so no wait).
// Two sign-ups and one account deletion on their own documentation-range client IP, so
// they use their own quota (see helpers.ts on the rate limits).
const minute = Math.floor(Date.now() / 60_000) % 250;
test.use({
  extraHTTPHeaders: { "cf-connecting-ip": `198.18.0.${minute + 1}` },
});

type BrowserContext = ReturnType<Page["context"]>;
type Browser = NonNullable<ReturnType<BrowserContext["browser"]>>;
type Session = Awaited<ReturnType<BrowserContext["storageState"]>>;

/** A second browser holding the same session, with or without the cookie cache. */
async function browserWith(browser: Browser, state: Session, cached: boolean) {
  const context = await browser.newContext({
    storageState: {
      ...state,
      cookies: state.cookies.filter(
        (cookie) => cached || !cookie.name.includes("session_data")
      ),
    },
  });
  return context;
}

async function sessionCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) =>
    /session_(token|data)/.test(cookie.name)
  );
}

/** /sign-in renders signed out and the session cookies are gone. */
async function expectSignInSignedOut(context: BrowserContext) {
  const page = await context.newPage();
  const response = await page.goto("/sign-in");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(await sessionCookies(context)).toEqual([]);
}

/** /app/dashboard redirects to /sign-in, and the session cookies are gone. */
async function expectAppRedirects(context: BrowserContext) {
  const page = await context.newPage();
  const response = await page.goto("/app/dashboard");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await sessionCookies(context)).toEqual([]);
}

test("an erased account's session in another browser is signed out, cached or not", async ({
  browser,
  page,
}) => {
  const account = newAccount("erased");
  await signUp(page, account);
  const state = await page.context().storageState();
  const cached = await browserWith(browser, state, true);
  const uncached = await browserWith(browser, state, false);

  await open(page, "/app/settings/privacy");
  await page.getByLabel("Confirm your email").fill(account.email);
  await page.getByLabel("Current password").fill(account.password);
  await page
    .getByRole("button", { name: "Delete account permanently" })
    .click();
  await expect(page).toHaveURL(/\/$/);

  await expectSignInSignedOut(cached);
  await expectAppRedirects(uncached);
  await cached.close();
  await uncached.close();
});

test("a suspended account's session is signed out, cached or not", async ({
  browser,
  page,
}) => {
  const account = newAccount("suspended");
  await signUp(page, account);
  const state = await page.context().storageState();
  const cached = await browserWith(browser, state, true);
  const uncached = await browserWith(browser, state, false);

  const admin = await (
    await browser.newContext({ storageState: { cookies: [], origins: [] } })
  ).newPage();
  await signIn(admin, readAdminAccounts().admin);
  await open(admin, "/admin/users");
  await admin
    .getByRole("searchbox", { name: "Search users" })
    .fill(account.email);
  await admin.getByText(account.email).click();
  await admin.getByRole("button", { name: "Suspend" }).click();
  const dialog = admin.getByRole("dialog", {
    name: `Suspend ${account.name}?`,
  });
  await dialog.getByLabel("Reason").fill("Stale session check (E2E)");
  await dialog.getByRole("button", { name: "Suspend" }).click();
  await expect(admin.getByText(`${account.name} is suspended`)).toBeVisible();

  await expectAppRedirects(cached);
  await expectSignInSignedOut(uncached);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);

  await cached.close();
  await uncached.close();
  await admin.context().close();
});
