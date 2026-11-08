import { describe, expect, it } from "vitest";

import { getAuth } from "@/server/auth";
import { sessionOf } from "@/server/trpc/context";

import {
  APP_URL,
  callerFor,
  env,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";
import {
  authorizeAgain,
  connectAgent,
  mcpRequest,
  rpcBody,
  tokenRequest,
} from "./oauth";

/** The tRPC router as the web endpoint calls it from this user's browser session. */
async function browser(user: TestUser) {
  const current = await getAuth(env).api.getSession({
    headers: new Headers({ cookie: user.cookie }),
  });
  return {
    sessionId: current?.session.id,
    caller: callerFor(user, env, testRequestContext(), {
      session: sessionOf(current?.session ?? null),
      exchange: {
        headers: new Headers({ cookie: user.cookie, origin: APP_URL }),
        resHeaders: new Headers(),
      },
    }),
  };
}

const callTool = (token: string, name: string, args = {}) =>
  mcpRequest(env, token, {
    method: "tools/call",
    params: { name, arguments: args },
  });

async function auditRows(userId: string, action: string) {
  const { results } = await env.DB.prepare(
    "SELECT metadata FROM audit_events WHERE target_id = ? AND action = ?"
  )
    .bind(userId, action)
    .all<{ metadata: string }>();
  return results.map((row) => JSON.parse(row.metadata));
}

describe("connected agents", () => {
  it("lists an agent connected through the consent flow, records it, and disconnects it for good", async () => {
    const ada = await signUp("Ada Agents", "ada-agents@example.test");
    const agent = await connectAgent(env, ada, { clientName: "Claude" });

    // Allowing it was recorded, without the code, tokens or state.
    const authorized = await auditRows(ada.id, "mcp.client.authorized");
    expect(authorized).toEqual([
      {
        clientId: agent.clientId,
        scopes: ["openid", "profile", "email", "offline_access"],
      },
    ]);

    const { caller, sessionId } = await browser(ada);
    const listed = await caller.account.agents.list();
    expect(listed.items).toEqual([
      {
        clientId: agent.clientId,
        name: "Claude",
        host: "client.example.test",
        connectedAt: expect.any(Date),
        scopes: ["openid", "profile", "email", "offline_access"],
        session: {
          id: sessionId,
          userAgent: null,
          signedInAt: expect.any(Date),
          current: true,
        },
        thisConnection: false,
      },
    ]);
    expect(JSON.stringify(listed)).not.toContain(agent.refresh_token);

    // Over MCP, the agent sees itself.
    const asTool = await rpcBody(
      await callTool(agent.access_token, "list_connected_agents")
    );
    expect(asTool.result.structuredContent.items).toMatchObject([
      { clientId: agent.clientId, thisConnection: true },
    ]);

    // Still allowed: authorize goes straight back to the client.
    expect(
      (await authorizeAgain(env, ada, agent.clientId)).searchParams.has("code")
    ).toBe(true);

    expect(
      await caller.account.agents.disconnect({ clientId: agent.clientId })
    ).toEqual({ disconnected: true, thisConnection: false });
    expect((await caller.account.agents.list()).items).toEqual([]);

    // Its unexpired access token is refused, its refresh token is gone, and the next
    // authorization asks the person again.
    expect((await mcpRequest(env, agent.access_token)).status).toBe(401);
    const refresh = await tokenRequest(env, {
      grant_type: "refresh_token",
      client_id: agent.clientId,
      refresh_token: agent.refresh_token,
      resource: `${APP_URL}/mcp`,
    });
    expect(refresh.status).toBe(400);
    expect(await refresh.json()).toMatchObject({ error: "invalid_grant" });
    expect((await authorizeAgain(env, ada, agent.clientId)).pathname).toBe(
      "/consent"
    );
    // The browser session that approved it is still signed in.
    await expect(caller.account.sessions.list()).resolves.toMatchObject({
      items: [{ id: sessionId }],
    });

    const revoked = await auditRows(ada.id, "mcp.client.revoked");
    expect(revoked).toEqual([
      { clientId: agent.clientId, clientName: "Claude", thisConnection: false },
    ]);
    const all = JSON.stringify(await auditRows(ada.id, "mcp.client.revoked"));
    expect(all).not.toContain(agent.access_token);
    expect(all).not.toContain(agent.refresh_token);
  });

  it("an old token stays refused after the person allows the agent again", async () => {
    const ada = await signUp("Ada Again", "ada-again@example.test");
    const first = await connectAgent(env, ada);
    await callerFor(ada).account.agents.disconnect({
      clientId: first.clientId,
    });
    // Better Auth stores consent times in whole seconds: reconnect in a later second.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await connectAgent(env, ada, { clientId: first.clientId });
    expect((await mcpRequest(env, again.access_token)).status).toBe(200);
    expect((await mcpRequest(env, first.access_token)).status).toBe(401);
  });

  it("one user cannot see or disconnect another user's agents", async () => {
    const ada = await signUp("Ada Owner", "ada-owner-agents@example.test");
    const bea = await signUp("Bea Other", "bea-other-agents@example.test");
    const agent = await connectAgent(env, ada);
    const asBea = callerFor(bea);

    expect((await asBea.account.agents.list()).items).toEqual([]);
    await expect(
      asBea.account.agents.disconnect({ clientId: agent.clientId })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      cause: { code: "AGENT_NOT_FOUND" },
    });
    // Ada's agent keeps working and keeps its consent.
    expect((await mcpRequest(env, agent.access_token)).status).toBe(200);
    expect((await callerFor(ada).account.agents.list()).items).toHaveLength(1);
    expect(await auditRows(bea.id, "mcp.client.revoked")).toEqual([]);
  });

  it("an agent that disconnects itself gets its answer, then loses access", async () => {
    const ada = await signUp("Ada Self", "ada-self-agents@example.test");
    const agent = await connectAgent(env, ada);
    const other = await connectAgent(env, ada, { clientName: "Other agent" });

    const response = await callTool(agent.access_token, "disconnect_agent", {
      clientId: agent.clientId,
    });
    // The request in flight was authorized before the disconnect and completes.
    expect(response.status).toBe(200);
    const body = await rpcBody(response);
    expect(body.result.isError).toBeFalsy();
    expect(body.result.structuredContent).toEqual({
      disconnected: true,
      thisConnection: true,
    });

    // The next one is refused; another agent of the same person keeps working.
    expect((await mcpRequest(env, agent.access_token)).status).toBe(401);
    expect((await mcpRequest(env, other.access_token)).status).toBe(200);
    expect(await auditRows(ada.id, "mcp.client.revoked")).toMatchObject([
      { clientId: agent.clientId, thisConnection: true },
    ]);
  });

  it("an unknown client id is not found", async () => {
    const ada = await signUp("Ada Unknown", "ada-unknown-agents@example.test");
    await expect(
      callerFor(ada).account.agents.disconnect({ clientId: "no-such-client" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
