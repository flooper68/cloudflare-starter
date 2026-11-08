import { describe, expect, it } from "vitest";
import { seedAgentGrant, seedSession } from "../../test/agent-fixtures";
import { rows, seedUser, useCaseDeps } from "../../test/fixtures";
import { disconnectAgent } from "./disconnect-agent";

async function grantsOf(userId: string) {
  return {
    consents: await rows(
      "SELECT client_id FROM oauth_consent WHERE user_id = ?",
      userId
    ),
    refresh: await rows(
      "SELECT client_id FROM oauth_refresh_token WHERE user_id = ?",
      userId
    ),
    access: await rows(
      "SELECT client_id FROM oauth_access_token WHERE user_id = ?",
      userId
    ),
  };
}

describe("disconnectAgent", () => {
  it("removes that client's tokens and consent for this user only, and records it without secrets", async () => {
    const user = await seedUser("Ada Disconnect");
    const other = await seedUser("Grace Disconnect");
    await seedSession(user.id, "ada-disconnect-session");
    await seedSession(other.id, "grace-disconnect-session");
    for (const clientId of ["claude", "claude-code"])
      await seedAgentGrant({
        userId: user.id,
        clientId,
        sessionId: "ada-disconnect-session",
      });
    // The same client, connected by another user, stays connected.
    await seedAgentGrant({
      userId: other.id,
      clientId: "claude",
      sessionId: "grace-disconnect-session",
    });
    const deps = useCaseDeps();

    expect(
      await disconnectAgent(deps, { userId: user.id, clientId: "claude" })
    ).toEqual({ disconnected: true, thisConnection: false });

    const left = (list: Record<string, unknown>[]) =>
      list.map((row) => row.client_id);
    const mine = await grantsOf(user.id);
    expect(left(mine.consents)).toEqual(["claude-code"]);
    expect(left(mine.refresh)).toEqual(["claude-code"]);
    expect(left(mine.access)).toEqual(["claude-code"]);
    const theirs = await grantsOf(other.id);
    expect(left(theirs.consents)).toEqual(["claude"]);
    expect(left(theirs.refresh)).toEqual(["claude"]);
    // The client itself stays registered (other users may use it).
    expect(
      await rows("SELECT id FROM oauth_client WHERE client_id = 'claude'")
    ).toHaveLength(1);
    // The browser session is untouched.
    expect(
      await rows("SELECT id FROM session WHERE id = 'ada-disconnect-session'")
    ).toHaveLength(1);

    const [event] = await rows(
      "SELECT action, actor_user_id, target_id, metadata FROM audit_events WHERE action = 'mcp.client.revoked' AND target_id = ?",
      user.id
    );
    expect(event).toMatchObject({
      action: "mcp.client.revoked",
      actor_user_id: user.id,
    });
    expect(JSON.parse(String(event?.metadata))).toEqual({
      clientId: "claude",
      clientName: "Claude",
      thisConnection: false,
    });
    expect(String(event?.metadata)).not.toContain("secret");
  });

  it("refuses a client the user never connected, even one another user did", async () => {
    const user = await seedUser("Ada Stranger");
    const other = await seedUser("Grace Stranger");
    await seedAgentGrant({ userId: other.id, clientId: "graces-client" });
    await expect(
      disconnectAgent(useCaseDeps(), {
        userId: user.id,
        clientId: "graces-client",
      })
    ).rejects.toMatchObject({ code: "AGENT_NOT_FOUND" });
    expect((await grantsOf(other.id)).consents).toHaveLength(1);
  });

  it("marks an agent disconnecting itself", async () => {
    const user = await seedUser("Ada Self");
    await seedAgentGrant({ userId: user.id, clientId: "self-client" });
    expect(
      await disconnectAgent(useCaseDeps(), {
        userId: user.id,
        clientId: "self-client",
        currentClientId: "self-client",
      })
    ).toEqual({ disconnected: true, thisConnection: true });
  });
});
