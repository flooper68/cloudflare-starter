/**
 * tour, 1:30. Signed out on `/`. Storyboard: plans/home-docs-v2.md, section 12, with
 * two changes for today's app: Ada signs in (the seed made her account) instead of
 * signing up, and the invite goes to Katherine (Grace is already a member).
 */
import { DEMO, LIVE } from "../lib/seed";
import { connect, go, settle, summary } from "./scenes";
import type { VideoScript } from "./types";

export const tour: VideoScript = {
  id: "tour",
  signedIn: false,
  async record({ d, page, agent: newAgent }) {
    const agent = newAgent();
    await go(page, "/");
    await d.placeCursor(1000, 520);

    await d.step(
      0,
      "A small app your agents can use",
      "This is Cloudflare Starter: a small app your agents can use."
    );
    await d.pause(2500);
    await d.moveTo(1100, 400);
    await d.pause(1500);
    await d.moveToLocator(
      page.getByRole("banner").getByRole("link", { name: "Sign in" })
    );

    await d.step(
      8,
      "The demo is the starter",
      "The demo is the starter itself."
    );
    await d.click(
      page.getByRole("banner").getByRole("link", { name: "Sign in" })
    );
    await settle(page);
    await d.type(page.getByLabel("Email"), DEMO.owner.email);
    await d.type(page.getByLabel("Password"), DEMO.owner.password);
    await d.click(page.getByRole("button", { name: "Sign in", exact: true }));
    await page.waitForURL(/\/app\/dashboard$/);
    await settle(page);

    await d.step(
      18,
      "Already done for you",
      "Sign-in, workspaces and billing are already done."
    );
    await d.moveToLocator(page.getByText("Get started"));
    await d.pause(1500);
    await d.moveToLocator(page.getByText("Invite a teammate").first());

    await d.step(
      28,
      "An agent asks for access",
      "An agent asks for access. You allow it."
    );
    await connect(d, agent);
    await d.pause(800);
    await go(page, "/app/dashboard");
    await d.showConsole();

    await d.step(38, "It works as you", "It works in your app, as you.");
    const created = await agent.call("create_note", LIVE.agentNote);
    await d.agentSays({
      call: `create_note  "${LIVE.agentNote.title}"`,
      result: summary(created, () => "created"),
      ok: created.ok,
    });
    await d.pause(700);
    await d.click(page.getByRole("link", { name: "Notes", exact: true }));
    await settle(page);
    await d.moveToLocator(page.getByText(LIVE.agentNote.title).first());
    await d.poster();
    await d.pause(1200);
    await d.hideConsole();

    await d.step(48, "Invite your team", "Invite your team.");
    await d.click(page.getByRole("link", { name: "Members", exact: true }));
    await settle(page);
    await d.click(page.getByRole("button", { name: "Invite people" }));
    const dialog = page.getByRole("dialog", { name: "Invite people" });
    await d.type(dialog.getByLabel("Email"), LIVE.invitee);
    await d.click(dialog.getByRole("button", { name: "Send invitation" }));

    await d.step(58, "Plans and limits", "Plans and limits are built in.");
    await d.click(page.getByRole("link", { name: "Billing", exact: true }));
    await settle(page);
    await d.moveToLocator(page.getByText("Usage", { exact: true }));
    await d.pause(1200);
    await d.moveToLocator(page.getByText("Seats", { exact: true }).last());

    await d.step(
      68,
      "Admin, health and logs",
      "Admin, health and logs: solved."
    );
    await d.click(page.getByRole("link", { name: "Admin", exact: true }));
    await settle(page);
    await d.moveToLocator(page.getByText("Health", { exact: true }).first());
    await d.pause(1500);
    await d.click(page.getByRole("button", { name: "Check again" }));

    await d.step(78, "The $5 plan", "It all runs on the $5 Cloudflare plan.");
    await go(page, "/");
    // The section, from its "$5/month" to the receipt, in the middle of the screen.
    await page
      .locator("#costs-title")
      .evaluate((heading) => heading.scrollIntoView({ block: "center" }));
    await d.moveToLocator(page.locator("#costs-title"));

    await d.step(85, "Clone it and ship", "Clone it and ship.");
    await go(page, "/");
    await d.moveToLocator(
      page.getByRole("link", { name: "View on GitHub" }).first()
    );
    await d.end(90);
  },
};
