/**
 * agents, 1:15. Ada signed in, no agents connected. Storyboard:
 * plans/home-docs-v2.md, section 12 (the Brain spec).
 */
import { AGENT_NAME } from "../lib/agent";
import { SEED } from "../lib/seed";
import { connect, go, settle, summary, titles } from "./scenes";
import type { VideoScript } from "./types";

export const agents: VideoScript = {
  id: "agents",
  signedIn: true,
  async record({ d, page, seed, agent: newAgent }) {
    const agent = newAgent();
    await go(page, "/app/settings/connected-agents");
    await d.placeCursor(900, 600);

    await d.step(0, "No agents connected yet", "No agents connected yet.");
    await d.pause(1500);
    await d.moveToLocator(
      page.getByRole("heading", { name: "Connected agents", level: 2 })
    );

    await d.step(8, "An agent asks to connect", "An agent asks to connect.");
    await d.showConsole();
    await connect(d, agent, {
      onConsent: async () => {
        await d.step(
          16,
          "Sign in and allow",
          "You see what it may do, then allow it."
        );
        await d.moveToLocator(page.getByText("It will be able to"));
        await d.pause(2500);
      },
    });

    await d.step(26, "It reads your notes", "It reads your notes.");
    await go(page, "/app/notes");
    await d.showConsole();
    await d.pause(800);
    const listed = await agent.call("list_notes", {});
    await d.agentSays({
      call: "list_notes",
      result: summary(listed, titles),
      ok: listed.ok,
    });

    await d.step(34, "It writes a note", "It writes one; you see it at once.");
    const created = await agent.call("create_note", SEED.agentNote);
    await d.agentSays({
      call: `create_note  "${SEED.agentNote.title}"`,
      result: summary(created, () => "created"),
      ok: created.ok,
    });
    await d.pause(600);
    await d.click(page.getByRole("link", { name: "Notes", exact: true }));
    await page.reload();
    await settle(page);
    await d.showConsole();
    await d.moveToLocator(page.getByText(SEED.agentNote.title).first());
    await d.poster();

    await d.step(
      44,
      "Same permissions as you",
      "Same permissions as you, nothing more."
    );
    const denied = await agent.call("list_notes", {
      workspaceId: seed.otherWorkspaceId,
    });
    await d.agentSays({
      call: "list_notes  in Grace's personal workspace",
      result: summary(denied),
      ok: denied.ok,
    });
    await d.pause(2000);

    await d.step(
      52,
      "Settings › Connected agents",
      "Every agent you allowed, in one place."
    );
    await d.click(page.getByRole("link", { name: "Settings", exact: true }));
    await settle(page);
    await d.click(page.getByRole("link", { name: "Connected agents" }));
    await settle(page);
    await d.showConsole();
    await d.moveToLocator(page.getByText(AGENT_NAME, { exact: true }));

    await d.step(62, "Disconnect it", "Disconnect it.");
    await d.click(
      page.getByRole("button", { name: `Disconnect ${AGENT_NAME}` })
    );
    const dialog = page.getByRole("alertdialog");
    await d.pause(900);
    await d.click(dialog.getByRole("button", { name: "Disconnect" }));
    await page.getByText("Agent disconnected").waitFor();

    await d.step(69, "Its next call is refused", "Its next call is refused.");
    const refused = await agent.call("list_notes", {});
    await d.agentSays({
      call: "list_notes",
      result: summary(refused),
      ok: refused.ok,
    });
    await d.end(75);
  },
};
