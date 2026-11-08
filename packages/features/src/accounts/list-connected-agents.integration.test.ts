import { describe, expect, it } from "vitest";
import { seedAgentGrant, seedSession } from "../../test/agent-fixtures";
import { seedUser, useCaseDeps } from "../../test/fixtures";
import { listConnectedAgents } from "./list-connected-agents";

describe("listConnectedAgents", () => {
  it("lists only the user's own agents, with their approving session and no secrets", async () => {
    const user = await seedUser("Ada Agents");
    const other = await seedUser("Grace Agents");
    await seedSession(user.id, "ada-chrome");
    await seedAgentGrant({
      userId: user.id,
      clientId: "claude-desktop",
      name: "Claude",
      sessionId: "ada-chrome",
      consentedAt: Date.parse("2026-11-03T09:00:00Z"),
    });
    await seedAgentGrant({
      userId: user.id,
      clientId: "claude-code",
      name: "Claude Code",
      consentedAt: Date.parse("2026-11-06T09:00:00Z"),
      scopes: ["openid"],
    });
    await seedAgentGrant({
      userId: other.id,
      clientId: "graces-agent",
      name: "Grace's agent",
    });

    const agents = await listConnectedAgents(useCaseDeps(), {
      userId: user.id,
      currentSessionId: "ada-chrome",
      currentClientId: "claude-code",
    });

    expect(agents.map((agent) => agent.clientId)).toEqual([
      "claude-code",
      "claude-desktop",
    ]);
    expect(agents[0]).toMatchObject({
      name: "Claude Code",
      host: "claude.ai",
      scopes: ["openid"],
      session: null,
      thisConnection: true,
    });
    expect(agents[1]).toMatchObject({
      name: "Claude",
      scopes: ["openid", "offline_access"],
      session: { id: "ada-chrome", current: true },
      thisConnection: false,
    });
    expect(JSON.stringify(agents)).not.toContain("secret");
    expect(
      await listConnectedAgents(useCaseDeps(), { userId: other.id })
    ).toHaveLength(1);
  });

  it("is empty for a user who connected nothing", async () => {
    const user = await seedUser("Nobody Connected");
    expect(
      await listConnectedAgents(useCaseDeps(), { userId: user.id })
    ).toEqual([]);
  });
});
