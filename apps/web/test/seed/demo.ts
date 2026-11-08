/**
 * The demo data: one sample workspace with people, notes, a file, a trashed note, a
 * pending invitation and a connected agent, the same every time. Used by the docs
 * screenshot pipeline (test/screens/) and meant for the walkthrough video recorder and a
 * demo instance too, so screenshots, videos and the demo show the same world.
 *
 * `seedDemo(page)` builds it through the app itself (the real sign-up, invitation and
 * OAuth flows) against a local dev server with local bindings, and is idempotent: run it
 * again and it only adds what is missing. Local test values only; nothing here is a real
 * account or secret.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "../e2e/fixtures";
import { latestMailMentioning, open } from "../e2e/helpers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Local test password of every demo account (never a real one). */
const PASSWORD = "Demo-only-password-2026";

export const DEMO = {
  workspace: "Acme (sample)",
  owner: { name: "Ada Lovelace", email: "ada@demo.test", password: PASSWORD },
  member: {
    name: "Grace Hopper",
    email: "grace@demo.test",
    password: PASSWORD,
  },
  /** Invited, never accepts: the pending row on the Members page. */
  invited: "alan@demo.test",
  notes: [
    {
      title: "Q3 launch checklist",
      body: "Freeze the pricing page\nRun the restore drill\nWrite the release notes",
      comment: "The drill is booked for Thursday.",
    },
    { title: "Renew domain", body: "Expires on the 30th. Card on file." },
    {
      title: "Onboarding checklist",
      body: "Verify email\nInvite a teammate\nTurn on two-factor",
    },
    {
      title: "Pricing page copy",
      body: "Free, Pro and Team. Lead with the trial.",
    },
    {
      title: "Ideas for v2",
      body: "Shared tags\nWeekly digest\nAn agent that files notes",
    },
  ],
  /** Created, then moved to the trash: the Trash page's item. */
  trashed: {
    title: "Old pricing draft",
    body: "Superseded by Pricing page copy.",
  },
  file: {
    name: "brief.txt",
    body: "Acme brief: a small notes app your agents can use.\n",
  },
  agent: "Demo MCP client",
} as const;

export interface DemoAccount {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

const CALLBACK = "https://agent.demo.test/callback";

async function trySignIn(page: Page, account: DemoAccount): Promise<boolean> {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return page
    .waitForURL(/\/app\/dashboard$/, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
}

/** Signs the account in, signing it up first when it does not exist yet. */
export async function signInDemo(
  page: Page,
  account: DemoAccount,
  next?: string
) {
  if (await trySignIn(page, account)) return;
  await open(
    page,
    next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"
  );
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(next ? new RegExp(next) : /\/app\/dashboard$/);
}

/** Switches to the demo workspace, creating it when it is missing. */
async function switchToDemoWorkspace(page: Page) {
  await open(page, "/app/dashboard");
  const menu = page.getByRole("button", { name: /workspace menu$/ });
  await menu.click();
  const existing = page
    .getByRole("menu")
    .getByText(DEMO.workspace, { exact: true });
  await page.getByRole("menuitem", { name: "Create workspace" }).waitFor();
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.getByRole("menuitem", { name: "Create workspace" }).click();
    const dialog = page.getByRole("dialog", { name: "Create workspace" });
    await dialog.getByLabel("Name").fill(DEMO.workspace);
    await dialog.getByRole("button", { name: "Create" }).click();
  }
  await expect(
    page.getByRole("button", { name: `${DEMO.workspace} workspace menu` })
  ).toBeVisible();
}

async function noteTitles(page: Page): Promise<string[]> {
  await open(page, "/app/notes");
  const list = page.getByRole("listbox", { name: "Notes" });
  if (!(await list.count())) return [];
  return list.getByRole("option").allInnerTexts();
}

async function createNote(
  page: Page,
  note: { title: string; body: string; comment?: string }
) {
  await open(page, "/app/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByLabel("Title").fill(note.title);
  await page.getByRole("textbox", { name: /^Note/ }).fill(note.body);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  if (note.comment) {
    await page.getByRole("textbox", { name: "Comment" }).fill(note.comment);
    await page.getByRole("button", { name: "Send comment" }).click();
    await expect(page.getByText(note.comment)).toBeVisible();
  }
}

async function seedNotes(page: Page) {
  const titles = (await noteTitles(page)).join("\n");
  // Oldest first, so the list shows them in the plan's order.
  for (const note of [...DEMO.notes].reverse())
    if (!titles.includes(note.title)) await createNote(page, note);
}

async function seedTrash(page: Page) {
  await open(page, "/app/trash");
  if (await page.getByText(DEMO.trashed.title).count()) return;
  await createNote(page, DEMO.trashed);
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
}

async function seedFile(page: Page) {
  await open(page, "/app/upload-demo");
  if (await page.getByRole("link", { name: DEMO.file.name }).count()) return;
  await page.locator("#binding-upload-file").setInputFiles({
    name: DEMO.file.name,
    mimeType: "text/plain",
    buffer: Buffer.from(DEMO.file.body),
  });
  await expect(page.getByText(/Status: Stored as /)).toBeVisible();
}

async function membersText(page: Page): Promise<string> {
  await open(page, "/app/members");
  return (
    (await page.getByRole("table", { name: "Members" }).textContent()) ?? ""
  );
}

async function invite(page: Page, email: string): Promise<string> {
  await open(page, "/app/members");
  await page.getByRole("button", { name: "Invite people" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite people" });
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(`Invitation sent to ${email}`)).toBeVisible();
  const link = /https?:\/\/[^\s]+\/invite\/[0-9a-f]{64}/.exec(
    latestMailMentioning(DEMO.workspace)
  )?.[0];
  if (!link) throw new Error(`no invitation link for ${email}`);
  return new URL(link).pathname;
}

/** Grace joins through a real invitation; Alan's stays pending. */
async function seedPeople(page: Page) {
  const members = await membersText(page);
  if (!members.includes(DEMO.member.email)) {
    const path = await invite(page, DEMO.member.email);
    const context = await page
      .context()
      .browser()
      ?.newContext({
        storageState: { cookies: [], origins: [] },
      });
    if (!context) throw new Error("no browser");
    const guest = await context.newPage();
    await signInDemo(guest, DEMO.member, path);
    await open(guest, path);
    await guest.getByRole("button", { name: "Accept and join" }).click();
    await expect(guest).toHaveURL(/\/app\/dashboard$/);
    await context.close();
  }
  if (!(await membersText(page)).includes(DEMO.invited))
    await invite(page, DEMO.invited);
}

/**
 * Registers an MCP client and takes it to the consent page, as Claude does. Returns
 * once the consent page shows; `allow` clicks Allow and waits for the callback.
 */
export async function agentConsent(
  page: Page,
  clientName: string,
  allow: boolean
) {
  const baseURL = new URL(page.url()).origin;
  const mcp = `${baseURL}/mcp`;
  const registered = await page.request.post("/api/auth/oauth2/register", {
    headers: { origin: baseURL },
    data: {
      client_name: clientName,
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid profile email offline_access",
      resources: [mcp],
    },
  });
  expect(registered.status()).toBe(201);
  const { client_id: clientId } = (await registered.json()) as {
    client_id: string;
  };
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let called = false;
  await page.route(`${CALLBACK}*`, (route) => {
    called = true;
    return route.fulfill({ contentType: "text/plain", body: "connected" });
  });
  const authorize = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALLBACK,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid profile email offline_access",
    resource: mcp,
    state: "demo",
    prompt: "consent",
  });
  await open(page, `/api/auth/oauth2/authorize?${authorize}`);
  await expect(page).toHaveURL(/\/consent\?/);
  await expect(page.getByText(clientName).first()).toBeVisible();
  if (!allow) return;
  await page.getByRole("button", { name: "Allow" }).click();
  await expect.poll(() => called).toBe(true);
}

async function seedAgent(page: Page) {
  await open(page, "/app/settings/connected-agents");
  if (await page.getByText(DEMO.agent).count()) return;
  await agentConsent(page, DEMO.agent, true);
}

/** Makes Ada a platform admin on the local D1, the documented way. */
function seedAdmin() {
  execFileSync("bun", ["scripts/setup-admin.ts", "--email", DEMO.owner.email], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

/** Builds the demo world; leaves `page` signed in as Ada in the demo workspace. */
export async function seedDemo(page: Page) {
  await signInDemo(page, DEMO.owner);
  seedAdmin();
  await switchToDemoWorkspace(page);
  await seedNotes(page);
  await seedTrash(page);
  await seedFile(page);
  await seedPeople(page);
  await seedAgent(page);
  // Sign in again so the session carries the admin role.
  await page.context().clearCookies();
  await signInDemo(page, DEMO.owner);
  await switchToDemoWorkspace(page);
}
