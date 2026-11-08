import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { open } from "./support/session";

// Checklist: Billing, as the workspace owner sees it in manual mode (production runs
// BILLING=manual). The admin's plan, add-on and override changes are in admin.qa.ts.
skipWithoutQaEnv();

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await newQaAccount(page, { role: "billing" });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("the owner's billing page shows the trial plan and usage meters, and no checkout", async () => {
  await open(page, "/app/billing");
  await expect(
    page.getByRole("heading", { name: "Billing", exact: true })
  ).toBeVisible();
  const manual = page.getByText("Your admin manages this workspace's plan.");
  const off = page.getByText("Billing is off");
  await expect(manual.or(off)).toBeVisible();
  test.skip(
    await off.isVisible(),
    "billing is off in this environment (BILLING=off)"
  );
  // A new account's personal workspace is on a trial, with its days left.
  await expect(page.getByText(/trial/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Storage used" })
  ).toBeVisible();
  // Manual mode sells nothing: no checkout and no billing portal.
  await expect(page.getByRole("button", { name: /^Switch to / })).toHaveCount(
    0
  );
  await expect(
    page.getByRole("button", { name: /billing portal|manage billing/i })
  ).toHaveCount(0);
  await expect(
    page.getByText(/Contact your admin|Ask a workspace owner/).first()
  ).toBeVisible();
});
