import { expect, test } from "@playwright/test";

import { open, readAdminAccounts, signIn, signOut } from "./helpers";

// The admin journey: an admin (made one with `bun run setup:admin` in admin.setup.ts)
// opens the portal, suspends a member, the member cannot sign in, the suspension is in the
// audit log, and the admin lifts it again (impersonation.spec.ts needs the member active).
test.describe.configure({ mode: "serial" });

test("an admin suspends a member; the member cannot sign in; the audit log shows it", async ({
  page,
}) => {
  const { admin, member } = readAdminAccounts();

  // Not an admin: the portal does not exist.
  await signIn(page, member);
  expect((await page.request.get("/admin/overview")).status()).toBe(404);
  await signOut(page);

  await signIn(page, admin);
  await page.getByRole("link", { name: "Admin" }).click();
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
  // Sign out from the app shell (its workspace menu).
  await open(page, "/app/dashboard");
  await signOut(page);

  // The member is refused at sign-in.
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByRole("button", { name: "Sign in" }).click();
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
});
