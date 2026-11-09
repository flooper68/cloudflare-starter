import { expect, test } from "./fixtures";

import { open, readAdminAccounts, signIn, signOut } from "./helpers";

// The admin journey: an admin (made one with `bun run setup:admin` in admin.setup.ts)
// opens the portal, suspends a member, the member cannot sign in, the suspension is in the
// audit log, and the admin lifts it again (impersonation.spec.ts needs the member active).
// Then the Analytics page, against canned answers of Cloudflare's analytics APIs
// (test/e2e/analytics-vite.mjs serves test/analytics-fixture.ts to the dev server). One
// journey, so the admin signs in once: sign-ins are limited per IP.
test.describe.configure({ mode: "serial" });

test("an admin suspends a member; the member cannot sign in; the audit log shows it", async ({
  page,
}) => {
  const { admin, member } = readAdminAccounts();

  // Not an admin: the portal does not exist.
  await signIn(page, member);
  expect((await page.request.get("/admin/overview")).status()).toBe(404);
  expect((await page.request.get("/admin/analytics")).status()).toBe(404);
  await signOut(page);

  await signIn(page, admin);
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Users" }).click();
  await page
    .getByRole("searchbox", { name: "Search users" })
    .fill(member.email);
  await page.getByText(member.email).click();
  await expect(page.getByRole("heading", { name: member.name })).toBeVisible();

  await page.getByRole("button", { name: "Suspend" }).click();
  const dialog = page.getByRole("dialog", { name: `Suspend ${member.name}?` });
  await dialog.getByLabel("Reason").fill("Spam invitations (E2E)");
  await dialog.getByRole("button", { name: "Suspend" }).click();
  await expect(page.getByText(`${member.name} is suspended`)).toBeVisible();
  await expect(page.getByText("Spam invitations (E2E)")).toBeVisible();

  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByText("user.banned").first()).toBeVisible();
  // Sign out from the app shell (its profile menu).
  await open(page, "/app/dashboard");
  await signOut(page);

  // The member is refused at sign-in.
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/suspended/i)).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);

  // The admin lifts the suspension.
  await signIn(page, admin);
  await open(page, "/admin/users");
  await page
    .getByRole("searchbox", { name: "Search users" })
    .fill(member.email);
  await page.getByText(member.email).click();
  await page.getByRole("button", { name: "Lift suspension" }).click();
  await expect(
    page.getByText(`${member.name} can sign in again`)
  ).toBeVisible();

  // Analytics: the funnel, the period in the URL.
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
