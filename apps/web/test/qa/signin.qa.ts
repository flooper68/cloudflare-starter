import { createVerifiedAccount } from "./support/accounts";
import { qaAddress } from "./support/env";
import { currentRunId } from "./support/fixture";
import { expectMail } from "./support/mail";
import {
  type Account,
  open,
  signIn,
  signOut,
  submitSignIn,
} from "./support/session";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/test";

// Checklist: Sign-in and sign-out. One account: sign out, a refused wrong password with
// the same answer as for an address that has no account, the right password, and the
// New sign-in notice from a second browser.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
let createdAt: number;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  createdAt = Date.now();
  account = { ...(await createVerifiedAccount(page, { role: "signin" })) };
});

test.afterAll(async () => {
  await page?.context().close();
});

test("sign out lands on / and the app asks to sign in again", async () => {
  await open(page, "/app/dashboard");
  await signOut(page);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a wrong password is refused with no hint whether the address exists", async () => {
  const refusal = async (email: string) => {
    await submitSignIn(page, email, `${account.password}-wrong`);
    const alert = page.getByRole("alert").filter({ hasText: /\S/ });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
    return ((await alert.textContent()) ?? "").trim();
  };
  const known = await refusal(account.email);
  const unknown = await refusal(qaAddress(currentRunId(), "nobody"));
  expect(known).toBe(unknown);
  expect(known).not.toMatch(/not found|no account|does not exist|unknown/i);
});

test("the right password signs in to the dashboard", async () => {
  await signIn(page, account);
});

test("a sign-in from another browser sends New sign-in to your account", async ({
  browser,
}) => {
  // The notice skips an account's first minute (a sign-up is not a sign-in to warn
  // about; packages/features/src/accounts/notify-new-sign-in.ts): wait out that rule.
  await expect
    .poll(() => Date.now() - createdAt, { timeout: 90_000, intervals: [1_000] })
    .toBeGreaterThan(65_000);
  // Another browser: a user agent no live session of the account has.
  const other = await newUserPage(browser, {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0 QA",
  });
  try {
    const since = Date.now();
    await signIn(other, account);
    await expectMail(
      account.email,
      "New sign-in to your account",
      since,
      false
    );
  } finally {
    await other.context().close();
  }
});
