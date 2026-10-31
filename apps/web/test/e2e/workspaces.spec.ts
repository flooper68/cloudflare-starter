import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import { newAccount, open, sharedSession } from "./helpers";

// Multi mode (wrangler.jsonc): the shared user creates a team workspace, uploads a file,
// invites a new account; the invitee signs up from the link, accepts and opens the file;
// the owner then sees the notification badge, opens the inbox and marks it read.
// One sign-up here (see helpers.ts on the rate limit). Personal mode and invite-only
// sign-up need a server with other vars; the API tests cover them
// (docs/architecture/testing.md#known-gaps).
test.describe.configure({ mode: "serial" });

/**
 * The newest mail the local `send_email` simulation wrote that mentions `text`. Miniflare
 * stores each message's text part under .wrangler/tmp/email/<instance>/email-text/.
 */
function latestMailMentioning(text: string): string {
  const root = join(process.cwd(), ".wrangler/tmp/email");
  const files = readdirSync(root).flatMap((instance) => {
    const dir = join(root, instance, "email-text");
    try {
      return readdirSync(dir).map((name) => join(dir, name));
    } catch {
      return [];
    }
  });
  const matching = files
    .filter((file) => readFileSync(file, "utf8").includes(text))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!matching[0]) throw new Error(`no mail mentions ${text}`);
  return readFileSync(matching[0], "utf8");
}

const team = `E2E Team ${Date.now().toString(36)}`;
const invitee = newAccount("invitee");
const content = `Shared plan ${Date.now()}\n`;
let invitationPath = "";

test.describe("invite a teammate into a workspace", () => {
  test.use({ storageState: sharedSession });

  test("the owner creates a workspace and uploads a file into it", async ({
    page,
  }) => {
    await open(page, "/app/dashboard");
    await page.getByRole("button", { name: /workspace menu/ }).click();
    await page.getByRole("menuitem", { name: "Create workspace" }).click();
    const dialog = page.getByRole("dialog", { name: "Create workspace" });
    await dialog.getByLabel("Name").fill(team);
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(
      page.getByRole("button", { name: `${team} workspace menu` })
    ).toBeVisible();

    await page.getByRole("link", { name: "Upload" }).click();
    await page.locator("#binding-upload-file").setInputFiles({
      name: "shared-plan.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(content),
    });
    await expect(
      page.getByRole("list", { name: "Workspace files" })
    ).toContainText("shared-plan.txt");
  });

  test("the owner invites a new account from the members page", async ({
    page,
  }) => {
    await open(page, "/app/members");
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await page.getByRole("button", { name: "Invite people" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite people" });
    await dialog.getByLabel("Email").fill(invitee.email);
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(
      page.getByText(`Invitation sent to ${invitee.email}`)
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Members" })).toContainText(
      invitee.email
    );

    const link = /https?:\/\/[^\s]+\/invite\/[0-9a-f]{64}/.exec(
      latestMailMentioning(team)
    )?.[0];
    expect(link).toBeTruthy();
    invitationPath = new URL(link as string).pathname;
  });
});

test("the invitee signs up from the link, joins and opens the shared file", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await open(page, invitationPath);
  await expect(
    page.getByRole("heading", { name: `Join ${team}` })
  ).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.getByLabel("Name").fill(invitee.name);
  await page.getByLabel("Email").fill(invitee.email);
  await page.getByLabel("Password").fill(invitee.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(new RegExp(`${invitationPath}$`));
  // The redirect can show SSR markup before the invitation's click handler hydrates.
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.getByRole("button", { name: "Accept and join" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(
    page.getByRole("button", { name: `${team} workspace menu` })
  ).toBeVisible();

  await page.getByRole("link", { name: "Upload" }).click();
  const file = page
    .getByRole("list", { name: "Workspace files" })
    .getByRole("link", { name: "shared-plan.txt" });
  const href = await file.getAttribute("href");
  const response = await page.request.get(href as string);
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe(content);

  await context.close();
});

test.describe("the owner hears that the invitee joined", () => {
  test.use({ storageState: sharedSession });

  test("the bell shows the unread notification; opening the inbox and marking it read clears it", async ({
    page,
  }) => {
    // The notification is written by a queued job: reload until the badge shows it.
    const unread = page.getByRole("button", {
      name: /^Notifications, \d+ unread$/,
    });
    await expect(async () => {
      await open(page, "/app/dashboard");
      await expect(unread).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    await unread.click();
    const panel = page.getByRole("dialog", { name: "Notifications" });
    const title = `${invitee.name} joined ${team}`;
    await expect(panel.getByRole("link", { name: title })).toBeVisible();
    await panel.getByRole("radio", { name: "Unread" }).click();
    await panel.getByRole("button", { name: `Mark read: ${title}` }).click();
    await expect(panel.getByRole("link", { name: title })).toBeHidden();
    await page.keyboard.press("Escape");

    await open(page, "/app/notifications");
    await expect(
      page.getByRole("list", { name: "Notifications" })
    ).toContainText(title);
  });
});
