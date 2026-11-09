import { expect, test } from "./fixtures";

import { open, readAdminAccounts, signIn, signOut } from "./helpers";

// The admin Analytics page against canned answers of Cloudflare's analytics APIs
// (test/e2e/analytics-vite.mjs serves test/analytics-fixture.ts to the dev server): an
// admin opens it from the sidebar, reads the funnel, switches the period (kept in the
// URL), and a member gets no such page.
test("an admin reads the funnel and switches the period", async ({ page }) => {
  const { admin, member } = readAdminAccounts();

  await signIn(page, member);
  expect((await page.request.get("/admin/analytics")).status()).toBe(404);
  await signOut(page);

  await signIn(page, admin);
  await open(page, "/admin/overview");
  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();

  const funnel = page.getByRole("list", { name: "Funnel" });
  await expect(funnel.getByText("Visits")).toBeVisible();
  await expect(funnel.getByText("820")).toBeVisible();
  await expect(funnel.getByText("Came back within 7 days")).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Visits by referrer", exact: true })
      .getByText("news.ycombinator.com")
  ).toBeVisible();
  await expect(
    page.getByText("Cloudflare Web Analytics: 905 visits, 2,140 page views")
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Errors and latency per route" })
  ).toBeVisible();

  await page.getByRole("radio", { name: "30 days" }).click();
  await expect(page).toHaveURL(/\/admin\/analytics\?days=30$/);
  await expect(page.getByText("Last 30 days", { exact: false })).toBeVisible();

  // A reload and Back keep the period the URL names.
  await page.reload();
  await expect(page.getByRole("radio", { name: "30 days" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  await expect(page.getByRole("radio", { name: "7 days" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
});
