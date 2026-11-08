import { randomBytes } from "node:crypto";
import { currentRunId, qaAddress } from "./support";
import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { expectMail, linkTo } from "./support/mail";
import {
  type Account,
  AUTH_WAIT,
  open,
  openSettings,
  signInAs,
  signOut,
  submitSignIn,
} from "./support/session";

// Checklist: Password reset. One account: the same answer for an address with no
// account, the reset mail and its link (once), the changed-password notice, and the old
// password refused. Two password-reset requests (3 a minute per IP).
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
let resetLink: string;
let oldPassword: string;
const newPassword = `${randomBytes(18).toString("base64url")}-Qa1`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  account = { ...(await newQaAccount(page, { role: "reset" })) };
  oldPassword = account.password;
});

test.afterAll(async () => {
  await page?.context().close();
});

async function requestReset(email: string) {
  await open(page, "/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(
      `If an account exists for ${email}, a reset link is on its way.`
    )
  ).toBeVisible();
}

test("the reset page answers the same whether or not the account exists", async () => {
  await open(page, "/app/dashboard");
  await signOut(page);
  await requestReset(qaAddress(currentRunId(), "nobody"));
});

test("the reset mail's link sets a new password", async () => {
  const since = new Date();
  await requestReset(account.email);
  const mail = await expectMail(
    account.email,
    "Reset your password",
    since,
    false
  );
  resetLink = linkTo(mail, "/api/auth/reset-password/");
  await page.goto(resetLink);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Choose a new password" })
  ).toBeVisible();
  const changed = new Date();
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  account.password = newPassword;
  await expectMail(account.email, "Your password was changed", changed, false);
});

test("the link works once", async () => {
  await page.goto(resetLink);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  // Better Auth sends a used token back as ?error=INVALID_TOKEN: no form, a new link.
  await expect(page).toHaveURL(/\/reset-password\?error=/);
  await expect(
    page.getByText("This reset link is invalid or has expired.")
  ).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Request a new link" })
  ).toBeVisible();
});

test("the old password is refused, the new one signs in, and the notice is in the inbox", async ({
  browser,
}) => {
  const fresh = await newUserPage(browser);
  try {
    await submitSignIn(fresh, account.email, oldPassword);
    await expect(fresh).toHaveURL(/\/sign-in/);
    await expect(
      fresh.getByRole("alert").filter({ hasText: /\S/ }).first()
    ).toBeVisible();
  } finally {
    await fresh.context().close();
  }
  await signInAs(page, account);
  await open(page, "/app/notifications");
  await expect(page.getByRole("list", { name: "Notifications" })).toContainText(
    "Your password was changed"
  );
});

test("afterwards: the suite's password again, so the run's cleanup can sign in", async () => {
  await openSettings(page, "security");
  await page.getByLabel("Current password").fill(account.password);
  await page.getByLabel("New password", { exact: true }).fill(oldPassword);
  await page.getByLabel("Confirm new password").fill(oldPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText(/Password updated/)).toBeVisible({
    timeout: AUTH_WAIT,
  });
  account.password = oldPassword;
});
