import { currentRunId, qaAddress, qaEnv } from "./support";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  takeSignUpSlot,
  test,
} from "./support/journey";
import { expectMail, linkTo } from "./support/mail";
import { qaPassword } from "./support/password";
import { registerAccount } from "./support/registry";
import { open, submitSignIn } from "./support/session";

// Checklist: Sign-up and email verification. The one journey that signs up through the
// form by hand (the others use createVerifiedAccount): check-inbox, one resend, sign-in
// before verifying, the link, and a broken link. One sign-up, two verification mails.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let email: string;
let password: string;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  email = qaAddress(currentRunId(), "signup");
  // The suite's password for the address, and its registry: the run's cleanup erases it.
  password = qaPassword(email, qaEnv().token);
  registerAccount(currentRunId(), email);
});

test.afterAll(async () => {
  await page?.context().close();
});

test("sign-up shows Check your inbox naming the address, and sends the link", async () => {
  const since = new Date();
  await open(page, "/sign-up");
  await page.getByLabel("Name").fill(`QA ${currentRunId()} signup`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await takeSignUpSlot();
  await page.getByRole("button", { name: "Create account" }).click();
  const checkInbox = page.getByRole("heading", { name: "Check your inbox" });
  const signedIn = page.getByRole("heading", { name: /^Welcome, / });
  await expect(checkInbox.or(signedIn)).toBeVisible();
  test.skip(
    await signedIn.isVisible(),
    "this environment signs up without verification (AUTH_REQUIRE_EMAIL_VERIFICATION=false)"
  );
  await expect(page.getByText(email)).toBeVisible();
  await expectMail(email, "Verify your email", since, false);
});

test("Resend link once says Sent. and sends a second link", async () => {
  const since = new Date();
  await page.getByRole("button", { name: "Resend link" }).click();
  await expect(page.getByText(/^Sent\./)).toBeVisible();
  const mail = await expectMail(email, "Verify your email", since, false);
  expect(linkTo(mail, "/api/auth/verify-email")).toContain("token=");
});

test("signing in before verifying shows the same Check your inbox card, not an error", async () => {
  await submitSignIn(page, email, password);
  await expect(
    page.getByRole("heading", { name: "Check your inbox" })
  ).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(/Unable to sign in|invalid/i)).toHaveCount(0);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the newest link verifies the address and leads to the dashboard", async () => {
  const mail = await expectMail(email, "Verify your email", new Date(0), false);
  await page.goto(linkTo(mail, "/api/auth/verify-email"));
  await expect(page).toHaveURL(/\/email-verified/);
  await expect(
    page.getByRole("heading", { name: "Email verified" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to the app" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const checklist = page.getByRole("list", { name: "Get started" });
  await expect(checklist).toContainText("Verify your email (done)");
  // A personal workspace on a trial plan.
  await open(page, "/app/billing");
  await expect(page.getByText(/trial/i).first()).toBeVisible();
});

test("a broken verification link says it doesn't work and offers a new one", async () => {
  await open(page, "/email-verified?error=INVALID_TOKEN");
  await expect(
    page.getByRole("heading", { name: "This link doesn't work" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Send a new link" })
  ).toBeVisible();
});
