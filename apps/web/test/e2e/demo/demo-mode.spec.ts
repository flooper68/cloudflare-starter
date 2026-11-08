import { expect, test } from "../fixtures";
import { newAccount, open, signUp } from "../helpers";

// Demo mode (DEMO_MODE=on, DEMO_RETENTION_DAYS=7, DEMO_SAMPLE_DATA=on) on its own dev
// server (project "demo" in playwright.config.ts, test/e2e/demo-vite.mjs). One sign-up.

const notice =
  /Demo instance: your account and data are deleted after 7 days\./;

test("a new sign-up sees the demo notice, the banner and the sample notes", async ({
  page,
  browser,
}) => {
  // Before anyone signs up: the notice above the form, with the GitHub link.
  await open(page, "/sign-up");
  const signUpNotice = page.getByRole("status", { name: "Demo instance" });
  await expect(signUpNotice).toContainText(notice);
  await expect(
    signUpNotice.getByRole("link", { name: /Get the starter on GitHub/ })
  ).toHaveAttribute("href", "https://github.com/flooper68/cloudflare-starter");

  const account = newAccount("demo");
  await signUp(page, account);

  // Every signed-in page: the banner.
  const banner = page.getByRole("status", { name: "Demo instance" });
  await expect(banner).toContainText(notice);
  await expect(
    banner.getByRole("link", { name: /Get the starter on GitHub/ })
  ).toBeVisible();

  // The sample notes, written by the queued seed job shortly after sign-up.
  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
  const welcome = page.getByRole("option", {
    name: /Sample: Welcome to the demo/,
  });
  await expect(async () => {
    await page.reload();
    await expect(welcome).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect(
    page.getByRole("option", { name: /Sample: Launch checklist/ })
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: /Sample: Product sync notes/ })
  ).toBeVisible();
  await welcome.click();
  await expect(
    page.getByText(/Sample comment: comments live with their note/)
  ).toBeVisible();
  await expect(banner).toBeVisible();

  // Dismissed for this browser session: gone after a reload too.
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Welcome to the demo/ })
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Demo instance" })).toHaveCount(
    0
  );

  // The next session (a new browser context, same account cookies): back again.
  const next = await browser.newContext({
    storageState: await page.context().storageState(),
  });
  const again = await next.newPage();
  await open(again, "/app/dashboard");
  await expect(
    again.getByRole("status", { name: "Demo instance" })
  ).toContainText(notice);
  await next.close();
});
