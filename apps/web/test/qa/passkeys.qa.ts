import { createVerifiedAccount } from "./support";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { expectMail } from "./support/mail";
import {
  type Account,
  AUTH_WAIT,
  authSlot,
  open,
  openSettings,
  signOut,
} from "./support/session";
import { freshTotpCode } from "./support/totp";

// Checklist: Passkeys. Chromium's WebAuthn virtual authenticator (CDP) stands in for the
// device: register, sign in with it, sign in with it once an authenticator is enrolled
// (the second factor is still asked for), remove it. One account. The app has no rename
// for passkeys (only the name given when adding one), so the checklist's rename step is
// not covered.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
const passkeyName = `QA passkey ${Date.now().toString(36)}`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  const device = await page.context().newCDPSession(page);
  await device.send("WebAuthn.enable");
  await device.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  account = { ...(await createVerifiedAccount(page, { role: "passkey" })) };
});

test.afterAll(async () => {
  await page?.context().close();
});

async function signInWithPasskey() {
  await signOut(page);
  await open(page, "/sign-in");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
}

test("adding a passkey lists it by name and sends the security notice", async () => {
  await openSettings(page, "security");
  const since = new Date();
  await page.getByLabel("Passkey name").fill(passkeyName);
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await expect(page.getByText(passkeyName, { exact: true })).toBeVisible();
  await expectMail(
    account.email,
    "Your account security changed",
    since,
    false
  );
});

test("the passkey signs in", async () => {
  await signInWithPasskey();
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});

test("with an authenticator enrolled, the passkey sign-in still asks for the second factor", async () => {
  await openSettings(page, "security");
  await page.getByLabel("Password for security changes").fill(account.password);
  const setupResponse = page.waitForResponse((response) =>
    response.url().endsWith("/two-factor/enable")
  );
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const { totpURI } = (await (await setupResponse).json()) as {
    totpURI: string;
  };
  await page.getByLabel("Verification code").fill(await freshTotpCode(totpURI));
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await page.getByRole("button", { name: "I saved my recovery codes" }).click();
  await expect(
    page.getByText("Your authenticator protects your sign-ins.")
  ).toBeVisible();

  await signInWithPasskey();
  await expect(page).toHaveURL(/\/two-factor/, { timeout: AUTH_WAIT });
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  // Not signed in yet: the passkey alone is one factor.
  await authSlot("/get-session");
  const pending = await page.request.get("/api/auth/get-session");
  expect(await pending.json()).toBeNull();
  await page.getByLabel("Verification code").fill(await freshTotpCode(totpURI));
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/, { timeout: AUTH_WAIT });
});

test("removing the passkey takes it off the list and sends the security notice", async () => {
  await openSettings(page, "security");
  const since = new Date();
  await page.getByRole("button", { name: `Remove ${passkeyName}` }).click();
  await expect(page.getByText(passkeyName, { exact: true })).toHaveCount(0);
  await expectMail(
    account.email,
    "Your account security changed",
    since,
    false
  );
});

test("afterwards: two-factor off, so the run's cleanup can sign in with the password", async () => {
  await openSettings(page, "security");
  await page.getByLabel("Password for security changes").fill(account.password);
  await page
    .getByRole("button", { name: "Disable two-factor authentication" })
    .click();
  await expect(
    page.getByRole("button", { name: "Set up authenticator" })
  ).toBeVisible({ timeout: AUTH_WAIT });
});
