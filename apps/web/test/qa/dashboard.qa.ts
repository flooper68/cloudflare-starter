import { createVerifiedAccount } from "./support";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { open } from "./support/session";

// Checklist: Dashboard and system screens. One account: the Get started list, the in-app
// 404 and the offline notice (emulated with the browser context offline). The member's
// 403 on workspace settings needs a member and is in workspaces.qa.ts.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await createVerifiedAccount(page, { role: "dash" });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("Get started lists the four steps, each open one with its way to do it, and the count matches", async () => {
  await open(page, "/app/dashboard");
  const list = page.getByRole("list", { name: "Get started" });
  await expect(list).toContainText("Verify your email (done)");
  await expect(list).toContainText("Invite a teammate (to do)");
  await expect(list).toContainText("Turn on two-factor authentication (to do)");
  await expect(list).toContainText("Write your first note (to do)");
  // In a personal workspace the invite step says how instead of offering a button.
  await expect(
    list
      .getByRole("link", { name: "Invite" })
      .or(list.getByText("Create a shared workspace from the workspace menu"))
  ).toBeVisible();
  await expect(list.getByRole("link", { name: "Set up" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Open Notes" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Verify" })).toHaveCount(0);
  await expect(page.getByText("1 of 4 done")).toBeVisible();
  await page.getByRole("link", { name: "Open demos" }).click();
  await expect(page).toHaveURL(/\/app\/demos$/);
});

test("an unknown app path shows Page not found inside the shell", async () => {
  await open(page, "/app/no-such-page");
  await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

test("offline shows the notice; Try again keeps it; back online it goes away", async () => {
  await open(page, "/app/dashboard");
  await expect(page.getByRole("list", { name: "Get started" })).toBeVisible();
  await page.context().setOffline(true);
  const notice = page.getByRole("alert").filter({ hasText: "You're offline." });
  try {
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Try again" }).click();
    await expect(notice).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
  await expect(notice).toBeHidden();
});
