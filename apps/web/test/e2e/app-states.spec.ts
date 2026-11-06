import { expect, test } from "./fixtures";

import { open, sharedSession } from "./helpers";

// System screens of the app, as the shared user: the in-app 404, the offline notice, the
// MCP consent page, and the dashboard's developer demos. No sign-up here.
test.use({ storageState: sharedSession });

test("an unknown app path shows the 404 inside the shell", async ({ page }) => {
  await open(page, "/app/no-such-page");
  await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
  await expect(
    page.getByText("The page you opened doesn't exist, or you can't see it.")
  ).toBeVisible();
  // The shell's navigation is still there.
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});

test("going offline shows the notice; reconnecting clears it", async ({
  page,
  context,
}) => {
  await open(page, "/app/dashboard");
  await expect(page.getByRole("list", { name: "Get started" })).toBeVisible();
  await context.setOffline(true);
  const notice = page.getByRole("alert").filter({ hasText: "You're offline." });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "Changes can't be saved until you reconnect."
  );
  // Still offline: "Try again" keeps the notice.
  await notice.getByRole("button", { name: "Try again" }).click();
  await expect(notice).toBeVisible();
  await context.setOffline(false);
  await expect(notice).toBeHidden();
});

test("the MCP consent page names the client's access in plain words", async ({
  page,
}) => {
  const query = new URLSearchParams({
    client_id: "e2e-unregistered-client",
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    scope: "openid profile email offline_access",
  });
  await open(page, `/consent?${query}`);
  await expect(
    page.getByRole("heading", { name: "Allow access?" })
  ).toBeVisible();
  await expect(page.getByText("claude.ai", { exact: true })).toBeVisible();
  const permissions = page.getByRole("list", { name: "Permissions requested" });
  await expect(permissions).toContainText(
    "Use the app's tools as you, in your workspaces"
  );
  await expect(permissions).toContainText("See your email address");
  await expect(permissions).toContainText("Stay connected until you revoke it");
  await expect(
    page.getByText(/Settings › Security › Active sessions/)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow" })).toBeEnabled();
});

test("the dashboard leads to the developer demos", async ({ page }) => {
  await open(page, "/app/dashboard");
  await page.getByRole("link", { name: "Open demos" }).click();
  await expect(page).toHaveURL(/\/app\/demos$/);
  await expect(
    page.getByRole("heading", { name: "Developer demos" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Open queue demo" }).click();
  await expect(page).toHaveURL(/\/app\/queue-demo$/);
});
