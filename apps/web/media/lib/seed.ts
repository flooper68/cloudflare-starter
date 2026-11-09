/**
 * The recordings' world is the shared demo seed (test/seed/demo.ts, `DEMO`), the same
 * one the docs screenshots show: Ada Lovelace owns "Acme (sample)" with its notes, a
 * file, a trashed note, Grace Hopper as a member and Alan Turing invited; Ada is the
 * platform admin. The recorder seeds it into its own fresh local state, without the
 * connected agent (the videos connect it on camera). What the videos add live is here
 * (`LIVE`). Change the world in test/seed/demo.ts, so screenshots and videos agree.
 */
import { join } from "node:path";
import type { Browser, Page } from "@playwright/test";

import { DEMO, seedDemo, signInDemo } from "../../test/seed/demo";

/** What the recordings create on camera. */
export const LIVE = {
  /** Written by the agent. */
  agentNote: {
    title: "Call Marta about invoice",
    body: "She asked about the March invoice. Call before Friday.",
  },
  /** Invited by Ada. */
  invitee: "katherine@demo.test",
} as const;

export { DEMO };

export interface SeedResult {
  /** Ada's signed-in session, for the recordings that start signed in. */
  readonly adaState: string;
  /** Grace's personal workspace, which Ada (and her agent) cannot open. */
  readonly otherWorkspaceId: string;
}

export async function seed(options: {
  readonly browser: Browser;
  readonly baseURL: string;
  readonly stateDir: string;
  readonly stub: (page: Page) => Promise<void>;
}): Promise<SeedResult> {
  const { browser, baseURL, stateDir, stub } = options;
  const adaContext = await browser.newContext({ baseURL });
  const ada = await adaContext.newPage();
  await stub(ada);
  await seedDemo(ada, { agent: false, persistTo: stateDir });
  const adaState = join(stateDir, "ada.json");
  await adaContext.storageState({ path: adaState });
  await adaContext.close();

  const graceContext = await browser.newContext({ baseURL });
  const grace = await graceContext.newPage();
  await stub(grace);
  await signInDemo(grace, DEMO.member);
  const listed = await grace.request.get(`${baseURL}/api/trpc/workspace.list`, {
    headers: { "x-trpc-source": "app" },
  });
  const { items } = (
    (await listed.json()) as {
      result: { data: { items: { id: string; name: string }[] } };
    }
  ).result.data;
  const otherWorkspaceId = items.find(
    (item) => item.name !== DEMO.workspace
  )?.id;
  await graceContext.close();
  if (!otherWorkspaceId) throw new Error("Grace has no personal workspace");
  return { adaState, otherWorkspaceId };
}
