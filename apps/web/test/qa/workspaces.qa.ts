import { createVerifiedAccount } from "./support/accounts";
import { expectMail, linkTo } from "./support/mail";
import {
  type Account,
  createWorkspace,
  displayName,
  open,
  switchWorkspace,
  trpc,
  workspaceMenu,
} from "./support/session";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/test";

// Checklist: Workspaces (create, switch, invite, accept, roles, leave, transfer). Two
// accounts, A (owner) and B (invitee). Also covers, because only this file has a member:
// the member's 403 on workspace settings (Dashboard and system screens) and the member's
// command palette (Command palette).
//
// The app's roles are owner and member (packages/features/src/workspaces/domain/
// permissions.ts): the checklist's "admin" is the owner role here. The UI has no control
// for "transfer ownership" or "leave": those steps call the procedures the UI would
// (workspace.transferOwnership, workspace.leave) as the signed-in person.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let a: Page;
let b: Page;
let accountA: Account;
let accountB: Account;
let nameA: string;
let nameB: string;
const shared = `QA ${process.env.QA_RUN_ID ?? "run"} shared`;

test.beforeAll(async ({ browser }) => {
  a = await newUserPage(browser);
  b = await newUserPage(browser);
  accountA = { ...(await createVerifiedAccount(a, { role: "ws-owner" })) };
  accountB = { ...(await createVerifiedAccount(b, { role: "ws-member" })) };
  nameA = await displayName(a);
  nameB = await displayName(b);
});

test.afterAll(async () => {
  await a?.context().close();
  await b?.context().close();
});

async function memberRow(page: Page, email: string) {
  await open(page, "/app/members");
  return page.getByRole("table", { name: "Members" }).getByRole("row").filter({
    hasText: email,
  });
}

test("A creates the shared workspace and switches between it and the personal one", async () => {
  await open(a, "/app/dashboard");
  const label = (await workspaceMenu(a).getAttribute("aria-label")) ?? "";
  const personal = label.replace(/ workspace menu$/, "");
  await createWorkspace(a, shared);
  await workspaceMenu(a).click();
  await expect(
    a.getByRole("menuitem", { name: new RegExp(shared) })
  ).toBeVisible();
  await a.keyboard.press("Escape");
  await switchWorkspace(a, personal);
  await switchWorkspace(a, shared);
});

test("A invites B by mail as a member; B accepts from the mail's link", async () => {
  await open(a, "/app/members");
  const since = Date.now();
  await a.getByRole("button", { name: "Invite people" }).click();
  const dialog = a.getByRole("dialog", { name: "Invite people" });
  await dialog.getByLabel("Email").fill(accountB.email);
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    a.getByText(`Invitation sent to ${accountB.email}`)
  ).toBeVisible();

  const invitation = await expectMail(
    accountB.email,
    `${nameA} invited you to ${shared}`,
    since,
    false
  );
  // Before accepting, B does not see the workspace.
  await open(b, "/app/dashboard");
  await workspaceMenu(b).click();
  await expect(
    b.getByRole("menuitem", { name: new RegExp(shared) })
  ).toHaveCount(0);
  await b.keyboard.press("Escape");

  const joined = Date.now();
  await b.goto(linkTo(invitation, "/invite/"));
  await expect(b.locator("astro-island[ssr]")).toHaveCount(0);
  await expect(
    b.getByRole("heading", { name: `Join ${shared}` })
  ).toBeVisible();
  await b.getByRole("button", { name: "Accept and join" }).click();
  await expect(b).toHaveURL(/\/app\/dashboard$/);
  await expect(workspaceMenu(b, shared)).toBeVisible();

  // A hears about it: the bell's unread badge, and the notification mail.
  await expectMail(accountA.email, `${nameB} joined ${shared}`, joined, true);
  const unread = a.getByRole("button", { name: /^Notifications, \d+ unread$/ });
  await expect(async () => {
    await open(a, "/app/dashboard");
    await expect(unread).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await unread.click();
  await expect(
    a
      .getByRole("dialog", { name: "Notifications" })
      .getByRole("link", { name: `${nameB} joined ${shared}` })
  ).toBeVisible();
  await a.keyboard.press("Escape");
});

test("B, a member, gets the 403 on workspace settings naming A as the owner", async () => {
  await open(b, "/app/settings/workspace");
  const noAccess = b.getByRole("region", { name: "No access" });
  await expect(noAccess).toContainText("You don't have access to this");
  await expect(noAccess).toContainText(
    `Ask ${nameA}, the owner of ${shared}, if you need it.`
  );
  // The shell stays: the sidebar is still there.
  await expect(
    b.getByRole("link", { name: "Dashboard", exact: true })
  ).toBeVisible();
  await noAccess.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(b).toHaveURL(/\/app\/dashboard$/);
});

test("B's command palette lists no workspace settings, no invite and no admin", async () => {
  await open(b, "/app/dashboard");
  await b.keyboard.press("ControlOrMeta+k");
  const palette = b.getByRole("dialog", { name: "Search and jump" });
  const search = palette.getByRole("combobox");
  await search.fill("settings");
  await expect(
    palette.getByRole("option", { name: "Settings: Account" })
  ).toBeVisible();
  await expect(
    palette.getByRole("option", { name: "Settings: Workspace" })
  ).toHaveCount(0);
  await search.fill("invite");
  await expect(
    palette.getByRole("option", { name: "Invite member" })
  ).toHaveCount(0);
  await search.fill("admin");
  await expect(palette.getByRole("option", { name: "Admin" })).toHaveCount(0);
  await b.keyboard.press("Escape");
});

test("A makes B an owner: the Members page shows it at once and B is told", async () => {
  const since = Date.now();
  const row = await memberRow(a, accountB.email);
  await row.getByRole("combobox", { name: `Role of ${nameB}` }).click();
  await a.getByRole("option", { name: "Owner", exact: true }).click();
  await expect(a.getByText("Role changed").first()).toBeVisible();
  await expect(
    row.getByRole("combobox", { name: `Role of ${nameB}` })
  ).toHaveText("Owner");
  await expectMail(
    accountB.email,
    `You are now Owner in ${shared}`,
    since,
    true
  );
  // Back to member, so the transfer below is a real one.
  await row.getByRole("combobox", { name: `Role of ${nameB}` }).click();
  await a.getByRole("option", { name: "Member", exact: true }).click();
  await expect(
    row.getByRole("combobox", { name: `Role of ${nameB}` })
  ).toHaveText("Member");
});

test("A transfers ownership to B, and B transfers it back", async () => {
  const members = async (page: Page) =>
    (
      await trpc<{ items: { userId: string; email: string; role: string }[] }>(
        page,
        "workspace.members.list",
        {},
        "query"
      )
    ).items;
  const idOf = async (page: Page, email: string) => {
    const member = (await members(page)).find((item) => item.email === email);
    if (!member) throw new Error(`${email} is not a member`);
    return member.userId;
  };

  await trpc(a, "workspace.transferOwnership", {
    userId: await idOf(a, accountB.email),
  });
  let roles = await members(a);
  expect(roles.find((m) => m.email === accountB.email)?.role).toBe("owner");
  expect(roles.find((m) => m.email === accountA.email)?.role).toBe("member");

  await trpc(b, "workspace.transferOwnership", {
    userId: await idOf(b, accountA.email),
  });
  roles = await members(a);
  expect(roles.find((m) => m.email === accountA.email)?.role).toBe("owner");
  expect(roles.find((m) => m.email === accountB.email)?.role).toBe("member");
  const row = await memberRow(a, accountB.email);
  await expect(
    row.getByRole("combobox", { name: `Role of ${nameB}` })
  ).toHaveText("Member");
});

test("B leaves: B no longer sees the workspace and A's Members page no longer lists B", async () => {
  await open(b, "/app/dashboard");
  await expect(workspaceMenu(b, shared)).toBeVisible();
  await trpc(b, "workspace.leave", {});
  await open(b, "/app/dashboard");
  await workspaceMenu(b).click();
  await expect(
    b.getByRole("menuitem", { name: new RegExp(shared) })
  ).toHaveCount(0);
  await b.keyboard.press("Escape");
  await open(a, "/app/members");
  await expect(a.getByRole("table", { name: "Members" })).not.toContainText(
    accountB.email
  );
});
