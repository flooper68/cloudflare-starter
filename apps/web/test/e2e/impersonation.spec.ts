import { expect, test } from "@playwright/test";

import { open, readAdminAccounts, signIn } from "./helpers";

// An admin impersonates a member: the app shows the member's view with a banner, and
// "Stop impersonating" returns to the admin's own session in the portal.
test("an admin impersonates a member and stops", async ({ page }) => {
  const { admin, member } = readAdminAccounts();
  await signIn(page, admin);
  await open(page, "/admin/users");
  await page
    .getByRole("searchbox", { name: "Search users" })
    .fill(member.email);
  await page.getByText(member.email).click();

  await page.getByRole("button", { name: "Impersonate" }).click();
  await page
    .getByRole("alertdialog", { name: `Impersonate ${member.name}?` })
    .getByRole("button", { name: "Impersonate" })
    .click();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(
    page.getByText(`You are signed in as ${member.name} (${member.email})`)
  ).toBeVisible();
  // The impersonated session is the member's: no admin portal.
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.getByRole("button", { name: "Stop impersonating" }).click();
  await expect(page).toHaveURL(/\/admin\/users\//);
  await expect(page.getByRole("heading", { name: member.name })).toBeVisible();
  await expect(page.getByText(/You are signed in as/)).toHaveCount(0);
});
