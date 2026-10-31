import { expect, type Page, test } from "@playwright/test";

import { open, readAdminAccounts, sharedSession, signIn } from "./helpers";

// The billing journey (BILLING=manual, from .dev.vars.example): an admin gives a fresh
// workspace a small storage limit (an override of 0 MB, the "small test plan": the real
// catalog stays as it is), the owner's upload is refused with the upgrade prompt, the
// admin raises the override in the portal, and the same upload succeeds. No sign-ups: the
// shared user and the admin from admin.setup.ts (see helpers.ts on the rate limit).

const workspace = `E2E Billing ${Date.now().toString(36)}`;

async function setStorageOverride(
  admin: Page,
  megabytes: string,
  reason: string
) {
  const form = admin.getByRole("form", { name: "Override" });
  await form.getByLabel("Limit (MB)").fill(megabytes);
  await form.getByLabel("Reason").fill(reason);
  await form.getByRole("button", { name: "Set override" }).click();
  await expect(admin.getByText("Override set")).toBeVisible();
}

async function upload(page: Page) {
  await page.locator("#binding-upload-file").setInputFiles({
    name: "quarterly-report.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(`Quarterly report ${Date.now()}\n`),
  });
}

test("a storage limit shows the upgrade prompt; the admin raises it and the upload succeeds", async ({
  browser,
}) => {
  const owner = await (
    await browser.newContext({ storageState: sharedSession })
  ).newPage();
  const admin = await (
    await browser.newContext({ storageState: { cookies: [], origins: [] } })
  ).newPage();

  // The owner creates a workspace for this journey (it becomes the active one).
  await open(owner, "/app/dashboard");
  await owner.getByRole("button", { name: /workspace menu/ }).click();
  await owner.getByRole("menuitem", { name: "Create workspace" }).click();
  const create = owner.getByRole("dialog", { name: "Create workspace" });
  await create.getByLabel("Name").fill(workspace);
  await create.getByRole("button", { name: "Create" }).click();
  await expect(
    owner.getByRole("button", { name: `${workspace} workspace menu` })
  ).toBeVisible();

  // The admin opens it in the portal and limits its storage to nothing.
  await signIn(admin, readAdminAccounts().admin);
  await open(admin, "/admin/workspaces");
  await admin.getByText(workspace).click();
  await expect(admin.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(admin.getByText("Manual billing")).toBeVisible();
  await setStorageOverride(admin, "0", "E2E: a small test plan");

  // The owner's upload is refused: the prompt says what happened and whom to ask.
  await owner.getByRole("link", { name: "Upload" }).click();
  await upload(owner);
  await expect(
    owner.getByText("You've reached the storage limit")
  ).toBeVisible();
  await expect(owner.getByText(/Contact your admin/)).toBeVisible();
  await owner.getByRole("link", { name: "View plan and usage" }).click();
  await expect(owner).toHaveURL(/\/app\/billing$/);
  await expect(
    owner.getByRole("progressbar", { name: "Storage used" })
  ).toBeVisible();
  await expect(owner.getByText("Limit reached")).toBeVisible();

  // The admin raises the limit (the server records it in the audit log).
  await setStorageOverride(admin, "10", "E2E: raised after the owner asked");
  await expect(admin.getByText("10 MB", { exact: true })).toBeVisible();

  // The same upload now succeeds.
  await owner.getByRole("link", { name: "Upload" }).click();
  await upload(owner);
  await expect(owner.getByText(/Status: Stored as /)).toBeVisible();
  await expect(owner.getByText("You've reached the storage limit")).toHaveCount(
    0
  );

  await owner.context().close();
  await admin.context().close();
});
