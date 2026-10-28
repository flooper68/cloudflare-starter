import { env } from "cloudflare:workers";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { handleMcp } from "@/server/mcp/handler";
import { buildMcpServer } from "@/server/mcp/server";

import { APP_URL, callerFor, signUp } from "./helpers";

async function rpc(
  caller: ReturnType<typeof callerFor>,
  method: string,
  params: unknown = {}
) {
  const handler = createMcpHandler(() => buildMcpServer(caller));
  const response = await handler.fetch(
    new Request(`${APP_URL}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  );
  const text = await response.text();
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return JSON.parse(json);
}

describe("/mcp", () => {
  it("challenges requests without a token, pointing at the resource metadata", async () => {
    const response = await handleMcp(
      new Request(`${APP_URL}/mcp`, { method: "POST", body: "{}" }),
      env
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/mcp"`
    );
  });

  it("rejects a token that is not a valid access token", async () => {
    const response = await handleMcp(
      new Request(`${APP_URL}/mcp`, {
        method: "POST",
        headers: { authorization: "Bearer not-a-jwt" },
        body: "{}",
      }),
      env
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'error="invalid_token"'
    );
  });

  it("tools act as the user against the real database", async () => {
    const user = await signUp("Nicole Example", "nicole@example.test");
    const caller = callerFor(user);

    const whoami = await rpc(caller, "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(whoami.result.structuredContent.user).toBe("nicole@example.test");

    const files = await rpc(caller, "tools/call", {
      name: "list_files",
      arguments: {},
    });
    expect(files.result.structuredContent).toEqual({ items: [] });

    const queued = await rpc(caller, "tools/call", {
      name: "enqueue_hello",
      arguments: { name: "from MCP" },
    });
    expect(queued.result.structuredContent).toEqual({ queued: true });
  });
});
