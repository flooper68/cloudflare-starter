/** Scenes several scripts share. */
import type { Page } from "@playwright/test";

import type { DemoAgent, ToolResult } from "../lib/agent";
import type { Director } from "../lib/director";

/** Opens a path and waits until it has rendered and hydrated. */
export async function go(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await settle(page);
}

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator("astro-island[ssr]")
    .first()
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => {});
}

/** The tool result as one short line for the agent console. */
export function summary(result: ToolResult, pick?: (data: unknown) => string) {
  if (!result.ok) {
    if (result.status === 401) return "401 Unauthorized: invalid_token";
    const code = /"code"\s*:\s*"([A-Z_]+)"/.exec(result.text)?.[1];
    if (code === "NOT_FOUND")
      return "refused: NOT_FOUND, not a workspace of yours";
    if (code) return `refused: ${code}`;
    return `refused: ${result.text.replace(/\s+/g, " ").slice(0, 70)}`;
  }
  const json = /\{[\s\S]*\}/.exec(result.text)?.[0];
  if (pick && json) {
    try {
      return pick(JSON.parse(json));
    } catch {
      // fall through
    }
  }
  return "ok";
}

/** The note titles a list_notes result names. */
export function titles(data: unknown): string {
  const items = (data as { items?: { title: string }[] }).items ?? [];
  return `${items.length} notes: ${items.map((item) => item.title).join(", ")}`;
}

/**
 * The agent registers and sends the person to the consent page (shown in `page`), who
 * allows it; the callback page says it is connected. Leaves the page on the callback.
 */
export async function connect(
  d: Director,
  agent: DemoAgent,
  options: { readonly onConsent?: () => Promise<void> } = {}
): Promise<void> {
  await agent.register();
  await d.agentSays({
    call: "register  client_name: Demo MCP client",
    result: "201 Created",
    ok: true,
  });
  const url = await agent.authorizeUrl(d.page);
  await d.agentSays({
    call: "open  /api/auth/oauth2/authorize",
    result: "waiting for you to allow it…",
    ok: true,
  });
  await d.pause(900);
  await go(d.page, url);
  await options.onConsent?.();
  await d.pause(1200);
  await d.click(d.page.getByRole("button", { name: "Allow" }));
  await d.page.waitForURL((url) => url.hostname === "agent.demo.test");
  await agent.exchange();
  await d.agentSays({
    call: "token  authorization_code",
    result: "access token received",
    ok: true,
  });
}
