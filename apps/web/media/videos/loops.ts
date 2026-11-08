/**
 * The short muted loops (6–10 s) for the home page's pillar cards and the feature map.
 * Each has one or two steps: the lead-in (getting to the right screen, connecting an
 * agent) is cut, so the loop is only the moment itself.
 */
import { SEED } from "../lib/seed";
import { connect, go, settle, summary } from "./scenes";
import type { VideoScript } from "./types";

/** Smaller than the walkthroughs, so the UI is still legible in a 250 px card. */
const LOOP_VIEWPORT = { width: 1120, height: 700 } as const;

export const loopAgentNote: VideoScript = {
  id: "loop-agent-note",
  signedIn: true,
  viewport: LOOP_VIEWPORT,
  async record({ d, page, agent: newAgent }) {
    const agent = newAgent();
    await connect(d, agent);
    await go(page, "/app/notes");
    await d.showConsole();
    await d.placeCursor(700, 640);

    await d.step(0, "An agent adds a note", "An agent adds a note.");
    await d.pause(900);
    const created = await agent.call("create_note", SEED.agentNote);
    await d.agentSays({
      call: `create_note  "${SEED.agentNote.title}"`,
      result: summary(created, () => "created"),
      ok: created.ok,
    });
    await d.pause(700);
    await d.click(page.getByRole("link", { name: "Notes", exact: true }));
    await page.reload();
    await settle(page);
    await d.showConsole();
    await d.moveToLocator(page.getByText(SEED.agentNote.title).first());
    await d.end(8);
  },
};

export const loopInvite: VideoScript = {
  id: "loop-invite",
  signedIn: true,
  viewport: LOOP_VIEWPORT,
  async record({ d, page }) {
    await go(page, "/app/members");
    await d.placeCursor(900, 500);

    await d.step(0, "Invite a teammate", "Invite a teammate.");
    await d.click(page.getByRole("button", { name: "Invite people" }));
    const dialog = page.getByRole("dialog", { name: "Invite people" });
    await d.type(dialog.getByLabel("Email"), SEED.katherine.email);
    await d.click(dialog.getByRole("button", { name: "Send invitation" }));
    await page
      .getByText(`Invitation sent to ${SEED.katherine.email}`)
      .waitFor();
    await d.end(8);
  },
};

export const loopJobMail: VideoScript = {
  id: "loop-job-mail",
  signedIn: true,
  viewport: LOOP_VIEWPORT,
  async record({ d, page }) {
    await go(page, "/app/settings/privacy");
    await d.placeCursor(900, 600);

    await d.step(
      0,
      "A job runs, the mail arrives",
      "A job runs, the mail arrives."
    );
    await d.click(
      page.getByRole("button", { name: "Request personal export" })
    );
    await page.getByText("Data export queued").waitFor();
    // The queue consumer builds it in a few seconds (batches wait up to 5 s locally).
    const download = page.getByRole("button", { name: /Download/ }).first();
    for (let attempt = 0; attempt < 8; attempt++) {
      await d.pause(1500);
      await d.click(page.getByRole("button", { name: "Refresh exports" }));
      if (await download.isVisible()) break;
    }
    await d.moveToLocator(download);
    await d.end(10);
  },
};

export const loopHealth: VideoScript = {
  id: "loop-health",
  signedIn: true,
  viewport: LOOP_VIEWPORT,
  async record({ d, page }) {
    await go(page, "/admin/overview");
    await d.placeCursor(900, 500);

    await d.step(0, "A health check goes green", "A health check goes green.");
    await d.click(page.getByRole("button", { name: "Check again" }));
    await d.pause(1200);
    const passes = page.getByText("Pass", { exact: true });
    await d.moveToLocator(passes.nth(1));
    await d.pause(600);
    await d.moveToLocator(passes.last());
    await d.end(6);
  },
};

export const loopConsent: VideoScript = {
  id: "loop-consent",
  signedIn: true,
  viewport: LOOP_VIEWPORT,
  async record({ d, page, agent: newAgent }) {
    const agent = newAgent();
    await agent.register();
    const url = await agent.authorizeUrl(page);
    await go(page, url);
    await d.placeCursor(900, 420);

    await d.step(0, "Consent, then Allow", "An agent asks; you allow it.");
    await d.moveToLocator(page.getByText("It will be able to"));
    await d.pause(3400);
    await d.click(page.getByRole("button", { name: "Allow" }));
    await page.waitForURL((url) => url.hostname === "agent.demo.test");
    await d.pause(1000);
    await d.end(0);
  },
};
