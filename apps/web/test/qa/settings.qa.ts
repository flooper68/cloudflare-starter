import {
  createVerifiedAccount,
  currentRunId,
  eraseQaAccount,
  inbox,
  qaAddress,
} from "./support";
import { tinyPng } from "./support/files";
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
  signInAs,
  signOut,
} from "./support/session";

// Checklist: Settings (profile, avatar, email change, sessions, connected accounts,
// appearance). One account; the email change moves it to a second run address
// (qa+<runId>-settings2@…), which the run's cleanup erases too.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
const newName = `QA ${process.env.QA_RUN_ID ?? "run"} renamed`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  account = { ...(await createVerifiedAccount(page, { role: "settings" })) };
});

test.afterAll(async ({ browser }) => {
  // After the email change the run's cleanup no longer finds this account under its
  // first address: erase it here, through the same privacy flow.
  if (account?.email.includes("settings2")) {
    await eraseQaAccount(browser, account).catch(() => undefined);
  }
  await page?.context().close();
});

test("the name changes and the shell shows it at once", async () => {
  await openSettings(page, "account");
  await page.getByLabel("Name", { exact: true }).fill(newName);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved").first()).toBeVisible();
  await open(page, "/app/dashboard");
  await expect(
    page.getByRole("heading", { name: `Welcome, ${newName}` })
  ).toBeVisible();
});

test("an avatar uploads and is removed; a file that is no image is refused", async () => {
  await openSettings(page, "account");
  await page.getByLabel("Upload avatar").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: tinyPng(7),
  });
  await expect(
    page.getByRole("button", { name: "Remove avatar" })
  ).toBeVisible();
  await expect(
    page.locator('img[src*="/api/account/avatar/"]').first()
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByRole("button", { name: "Remove avatar" })).toHaveCount(
    0
  );
  await expect(page.locator('img[src*="/api/account/avatar/"]')).toHaveCount(0);

  await page.getByLabel("Upload avatar").setInputFiles({
    name: "not-an-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is text, not a PNG\n"),
  });
  await expect(
    page
      .getByText(/Unable to upload image|not an image|PNG, JPEG or WebP/i)
      .first()
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove avatar" })).toHaveCount(
    0
  );
});

test("the email changes after the confirmation mail, and the new address signs in", async () => {
  const newEmail = qaAddress(currentRunId(), "settings2");
  const since = new Date();
  await openSettings(page, "account");
  await page.getByLabel("New email address").fill(newEmail);
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(
    page.getByText("Check your email to confirm the change").first()
  ).toBeVisible({
    timeout: AUTH_WAIT,
  });
  // The app sends "Confirm email change" to the current address (apps/web/src/server/
  // auth.ts, sendChangeEmailConfirmation); its link then verifies the new one.
  const confirm = await expectMail(
    account.email,
    "Confirm email change",
    since,
    false
  );
  const confirmLink = confirm.links.find((href) => href.includes("/api/auth/"));
  const confirmed = new Date();
  await page.goto(confirmLink as string);
  const verify = await inbox
    .waitFor({
      to: newEmail,
      subject: "Verify your email",
      since: confirmed,
      timeoutMs: 30_000,
    })
    .catch(() => null);
  if (verify) {
    const verifyLink = verify.links.find((href) =>
      href.includes("/api/auth/verify-email")
    );
    await page.goto(verifyLink as string);
  }
  await openSettings(page, "account");
  await expect(page.getByText(newEmail).first()).toBeVisible();
  account.email = newEmail;
  await signOut(page);
  await signInAs(page, account);
});

test("sessions: another browser's session is listed and signed out from here", async ({
  browser,
}) => {
  const other = await newUserPage(browser, {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0 QA",
  });
  try {
    await signInAs(other, account);
    await openSettings(page, "security");
    const signOutOther = page.getByRole("button", {
      name: "Sign out session",
      exact: true,
    });
    await expect(signOutOther).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Sign out this session", exact: true })
    ).toBeVisible();
    await signOutOther.click();
    await expect(page.getByText("Session signed out").first()).toBeVisible();
    await expect(signOutOther).toHaveCount(0);
    await authSlot("/get-session");
    const session = await other.request.get(
      "/api/auth/get-session?disableCookieCache=true"
    );
    expect(await session.json()).toBeNull();
  } finally {
    await other.context().close();
  }
});

test("connected accounts list email and password", async () => {
  await openSettings(page, "security");
  await expect(
    page.getByRole("heading", { name: "Connected accounts" })
  ).toBeVisible();
  await expect(page.getByText("Email and password").first()).toBeVisible();
});

test("appearance: the theme choice applies at once and persists after a reload", async () => {
  await openSettings(page, "appearance");
  await page.getByLabel("Theme", { exact: true }).click();
  await page.getByRole("option", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Theme", { exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Theme", { exact: true }).click();
  await page.getByRole("option", { name: "System", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});
