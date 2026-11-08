/**
 * The recordings' sample data, written into the recorder's own fresh local state (never
 * your dev data) through the app's own sign-up page and tRPC, as a person would:
 * Ada Lovelace owns "Acme (sample)" with five notes and two comments, Grace Hopper is a
 * member, Alan Turing is invited. Ada is also the platform admin, so the tour reaches the
 * admin portal without switching people. The names, notes and workspace are fixed, so
 * every recording shows the same data. Change it here; `bun run media:record`
 * re-creates it from nothing on every run.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { APIRequestContext, Browser, Page } from "@playwright/test";

export const SEED = {
  password: "Demo-password-1815",
  ada: { name: "Ada Lovelace", email: "ada@demo.test" },
  grace: { name: "Grace Hopper", email: "grace@demo.test" },
  alan: { name: "Alan Turing", email: "alan@demo.test" },
  /** Invited live in the recordings (loop-invite, tour). */
  katherine: { name: "Katherine Johnson", email: "katherine@demo.test" },
  workspace: "Acme (sample)",
  notes: [
    {
      title: "Q3 launch checklist",
      body: "Pricing page, changelog post, demo video, email to the beta list.",
    },
    {
      title: "Ideas for v2",
      body: "Shared views, reminders, a weekly digest for the team.",
    },
    {
      title: "Pricing page copy",
      body: "One plan, usage above the allowances. Keep it short.",
    },
    {
      title: "Onboarding checklist",
      body: "Verify email, invite a teammate, turn on two-factor.",
    },
    {
      title: "Renew domain",
      body: "acme.example renews on the 14th. Card on file.",
    },
  ],
  comments: [
    { note: "Q3 launch checklist", body: "Demo video is recording now." },
    { note: "Pricing page copy", body: "Looks good to me. Ship it." },
  ],
  /** Created by the agent in the recordings. */
  agentNote: {
    title: "Call Marta about invoice",
    body: "She asked about the March invoice. Call before Friday.",
  },
} as const;

/** Every mail's text part in the local email simulation, newest first. */
export function newestMails(appDir: string, since = 0): string[] {
  const root = join(appDir, ".wrangler/tmp/email");
  let instances: string[];
  try {
    instances = readdirSync(root);
  } catch {
    return [];
  }
  return instances
    .flatMap((instance) => {
      const dir = join(root, instance, "email-text");
      try {
        return readdirSync(dir).map((name) => join(dir, name));
      } catch {
        return [];
      }
    })
    .filter((file) => statSync(file).mtimeMs >= since)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((file) => readFileSync(file, "utf8"));
}

/**
 * The newest invitation link to `workspace` sent after `since` (ms); the mail is sent in
 * the background.
 */
export async function invitationLink(
  appDir: string,
  workspace: string,
  since: number
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const link = newestMails(appDir, since)
      .filter((mail) => mail.includes(workspace))
      .map((mail) => /https?:\/\/\S+\/invite\/[0-9a-f]{64}/.exec(mail)?.[0])
      .find(Boolean);
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no invitation mail for ${workspace}`);
}

async function trpc<T>(
  request: APIRequestContext,
  baseURL: string,
  path: string,
  input: unknown
): Promise<T> {
  const response = await request.post(`${baseURL}/api/trpc/${path}`, {
    headers: { "x-trpc-source": "app", origin: baseURL },
    data: input,
  });
  if (!response.ok())
    throw new Error(`${path}: ${response.status()} ${await response.text()}`);
  return ((await response.json()) as { result: { data: T } }).result.data;
}

export interface SignUpOptions {
  readonly page: Page;
  readonly name: string;
  readonly email: string;
}

/** Signs up through the sign-up page (the local Turnstile widget answers). */
export async function signUp({ page, name, email }: SignUpOptions) {
  await page.goto("/sign-up");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator("astro-island[ssr]")
    .first()
    .waitFor({ state: "detached" });
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED.password);
  await page.getByRole("button", { name: "Create account" }).click();
  try {
    await page.waitForURL(/\/app\/dashboard$/, { timeout: 60_000 });
  } catch (error) {
    const alert = await page
      .getByRole("alert")
      .allTextContents()
      .catch(() => []);
    throw new Error(
      `sign-up of ${email} did not reach the dashboard (at ${page.url()}${alert.length ? `, "${alert.join(" ")}"` : ""}): ${error}`
    );
  }
}

/** Opens the pages the seed uses once, so the first sign-up does not wait on a compile. */
async function warmUp(page: Page): Promise<void> {
  for (const path of ["/", "/sign-up", "/sign-in", "/app/dashboard"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

export interface SeedResult {
  /** Ada's signed-in session, for the recordings that start signed in. */
  readonly adaState: string;
  /** Grace's personal workspace, which Ada (and her agent) cannot open. */
  readonly otherWorkspaceId: string;
}

export async function seed(options: {
  readonly browser: Browser;
  readonly baseURL: string;
  readonly appDir: string;
  readonly stateDir: string;
  readonly stub: (page: Page) => Promise<void>;
}): Promise<SeedResult> {
  const { browser, baseURL, appDir, stateDir, stub } = options;
  const adaContext = await browser.newContext({ baseURL });
  const ada = await adaContext.newPage();
  await stub(ada);
  await warmUp(ada);
  await signUp({ page: ada, ...SEED.ada });

  // Ada is the platform admin, the documented way's SQL (scripts/setup-admin.ts).
  execFileSync(
    "bunx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--persist-to",
      stateDir,
      "--command",
      `UPDATE user SET role = 'admin' WHERE email = '${SEED.ada.email}'`,
    ],
    { cwd: appDir, stdio: "ignore" }
  );

  const created = await trpc<{ id?: string; workspaceId?: string }>(
    ada.request,
    baseURL,
    "workspace.create",
    { name: SEED.workspace }
  );
  const workspaceId = created.workspaceId ?? created.id;
  if (!workspaceId)
    throw new Error(`workspaces.create: ${JSON.stringify(created)}`);
  await trpc(ada.request, baseURL, "workspace.switch", { workspaceId });

  const noteIds = new Map<string, string>();
  for (const note of SEED.notes) {
    const result = await trpc<{ id?: string; noteId?: string }>(
      ada.request,
      baseURL,
      "notes.create",
      note
    );
    noteIds.set(note.title, (result.id ?? result.noteId) as string);
  }
  for (const comment of SEED.comments) {
    await trpc(ada.request, baseURL, "notes.comments.add", {
      noteId: noteIds.get(comment.note),
      body: comment.body,
    });
  }

  // Grace joins through an invitation; Alan's stays pending.
  const invited = Date.now() - 1000;
  await trpc(ada.request, baseURL, "workspace.invitations.create", {
    email: SEED.grace.email,
    role: "member",
  });
  const link = await invitationLink(appDir, SEED.workspace, invited);
  const graceContext = await browser.newContext({ baseURL });
  const grace = await graceContext.newPage();
  await stub(grace);
  await signUp({ page: grace, ...SEED.grace });
  // Grace's own workspace: Ada is not in it, so her agent may not read it either.
  const listed = await grace.request.get(`${baseURL}/api/trpc/workspace.list`, {
    headers: { "x-trpc-source": "app" },
  });
  const otherWorkspaceId = (
    (await listed.json()) as {
      result: { data: { items: { id: string }[] } };
    }
  ).result.data.items[0]?.id;
  if (!otherWorkspaceId) throw new Error("Grace has no workspace");
  await grace.goto(new URL(link).pathname);
  await grace
    .locator("astro-island[ssr]")
    .first()
    .waitFor({ state: "detached" });
  await grace.getByRole("button", { name: "Accept and join" }).click();
  await grace.waitForURL(/\/app\//);
  await graceContext.close();
  await trpc(ada.request, baseURL, "workspace.invitations.create", {
    email: SEED.alan.email,
    role: "member",
  });

  const adaState = join(stateDir, "ada.json");
  await adaContext.storageState({ path: adaState });
  await adaContext.close();
  return { adaState, otherWorkspaceId };
}
