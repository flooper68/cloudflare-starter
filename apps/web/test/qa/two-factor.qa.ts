import { createVerifiedAccount } from "./support/accounts";
import { expectMail } from "./support/mail";
import {
  type Account,
  AUTH_WAIT,
  openSettings,
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
import { freshTotpCode } from "./support/totp";

// Checklist: Two-factor (authenticator, recovery codes, email code). One account. The
// authenticator's codes are computed from the setup secret (support/totp.ts). Two wrong
// codes in all, far from the ten that lock verification.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
let totpURI: string;
let codes: string[];

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  account = { ...(await createVerifiedAccount(page, { role: "tfa" })) };
});

test.afterAll(async () => {
  await page?.context().close();
});

/** Signs out and in with the password: the second-factor step must follow. */
async function toSecondFactor() {
  await signOut(page);
  await submitSignIn(page, account.email, account.password);
  await expect(page).toHaveURL(/\/two-factor/, { timeout: AUTH_WAIT });
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

async function verify(
  label: "Verification code" | "Recovery code",
  code: string
) {
  await page.getByLabel(label).fill(code);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
}

test("enrolling an authenticator shows recovery codes and sends the security notice", async () => {
  await openSettings(page, "security");
  await page.getByLabel("Password for security changes").fill(account.password);
  const setupResponse = page.waitForResponse((response) =>
    response.url().endsWith("/two-factor/enable")
  );
  const since = Date.now();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const setup = (await (await setupResponse).json()) as {
    totpURI: string;
    backupCodes: string[];
  };
  totpURI = setup.totpURI;
  codes = setup.backupCodes;
  expect(codes.length).toBeGreaterThan(2);
  await page.getByLabel("Verification code").fill(await freshTotpCode(totpURI));
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await expect(page.getByText("Save your recovery codes")).toBeVisible();
  for (const code of codes) await expect(page.getByText(code)).toBeVisible();
  await page.getByRole("button", { name: "I saved my recovery codes" }).click();
  await expect(
    page.getByText("Your authenticator protects your sign-ins.")
  ).toBeVisible();
  await expectMail(
    account.email,
    "Your account security changed",
    since,
    false
  );
});

test("sign-in asks for a code; the authenticator's code completes it", async () => {
  await toSecondFactor();
  await verify("Verification code", await freshTotpCode(totpURI));
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});

test("a recovery code completes sign-in once; the same code is refused next time", async () => {
  const [first] = codes;
  await toSecondFactor();
  await page.getByRole("button", { name: "Use a recovery code" }).click();
  await verify("Recovery code", first ?? "");
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });

  await toSecondFactor();
  await page.getByRole("button", { name: "Use a recovery code" }).click();
  await verify("Recovery code", first ?? "");
  await expect(
    page.getByText(/invalid|couldn't verify/i).first()
  ).toBeVisible();
  await expect(page).toHaveURL(/\/two-factor/, { timeout: AUTH_WAIT });
  await page.getByRole("button", { name: "Use authenticator" }).click();
  await verify("Verification code", await freshTotpCode(totpURI));
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});

test("the emailed code completes sign-in", async () => {
  await toSecondFactor();
  const emailMe = page.getByRole("button", { name: "Email me a code" });
  test.skip(
    (await emailMe.count()) === 0,
    "the emailed code is off here (TWO_FACTOR_EMAIL_OTP=off)"
  );
  const since = Date.now();
  await emailMe.click();
  await expect(
    page.getByText("Enter the code sent to your email.")
  ).toBeVisible();
  const mail = await expectMail(
    account.email,
    "Your verification code",
    since,
    false
  );
  const code = /\b(\d{6})\b/.exec(mail.text)?.[1];
  expect(code, "a six-digit code in the mail").toBeTruthy();
  await verify("Verification code", code ?? "");
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});

test("regenerating recovery codes retires the old ones", async () => {
  await openSettings(page, "security");
  await page.getByLabel("Password for security changes").fill(account.password);
  const regenerated = page.waitForResponse((response) =>
    response.url().endsWith("/two-factor/generate-backup-codes")
  );
  const since = Date.now();
  await page.getByRole("button", { name: "Regenerate recovery codes" }).click();
  const fresh = (
    (await (await regenerated).json()) as { backupCodes: string[] }
  ).backupCodes;
  await expect(page.getByText(fresh[0] ?? "-")).toBeVisible();
  await expectMail(
    account.email,
    "Your account security changed",
    since,
    false
  );

  await toSecondFactor();
  await page.getByRole("button", { name: "Use a recovery code" }).click();
  await verify("Recovery code", codes[1] ?? "");
  await expect(
    page.getByText(/invalid|couldn't verify/i).first()
  ).toBeVisible();
  await verify("Recovery code", fresh[0] ?? "");
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});
