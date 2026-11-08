import { describe, expect, it } from "vitest";

import {
  agentHost,
  consentCoversToken,
  summarizeConnectedAgents,
} from "./connected-agents";

const now = new Date("2026-11-08T12:00:00.000Z");
const at = (iso: string) => new Date(iso);
const grant = {
  clientId: "claude",
  name: " Claude ",
  uri: "https://claude.ai",
  redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
  consentedAt: at("2026-11-03T09:00:00.000Z"),
  scopes: ["openid", "profile", "offline_access"],
};
const browser = {
  id: "session-chrome",
  userAgent: "Chrome on macOS",
  createdAt: at("2026-11-03T08:55:00.000Z"),
};
const refresh = {
  clientId: "claude",
  sessionId: "session-chrome",
  createdAt: at("2026-11-07T10:00:00.000Z"),
  expiresAt: at("2026-12-07T10:00:00.000Z"),
  revoked: null,
};

describe("summarizeConnectedAgents", () => {
  it("lists one agent per client with its approving session, newest first", () => {
    const agents = summarizeConnectedAgents({
      grants: [
        grant,
        {
          ...grant,
          clientId: "claude-code",
          name: "Claude Code",
          redirectUris: ["http://localhost:4567/callback"],
          consentedAt: at("2026-11-06T09:00:00.000Z"),
          scopes: ["openid"],
        },
      ],
      refreshTokens: [refresh],
      sessions: [browser],
      now,
      currentSessionId: "session-chrome",
      currentClientId: "claude-code",
    });
    expect(agents).toEqual([
      {
        clientId: "claude-code",
        name: "Claude Code",
        host: "localhost:4567",
        connectedAt: at("2026-11-06T09:00:00.000Z"),
        scopes: ["openid"],
        session: null,
        thisConnection: true,
      },
      {
        clientId: "claude",
        name: "Claude",
        host: "claude.ai",
        connectedAt: grant.consentedAt,
        scopes: ["openid", "profile", "offline_access"],
        session: {
          id: "session-chrome",
          userAgent: "Chrome on macOS",
          signedInAt: browser.createdAt,
          current: true,
        },
        thisConnection: false,
      },
    ]);
  });

  it("merges several consents of one client: the oldest time, every scope once", () => {
    const [agent] = summarizeConnectedAgents({
      grants: [
        grant,
        {
          ...grant,
          consentedAt: at("2026-11-01T09:00:00.000Z"),
          scopes: ["email", "openid"],
        },
      ],
      refreshTokens: [],
      sessions: [],
      now,
    });
    expect(agent?.connectedAt).toEqual(at("2026-11-01T09:00:00.000Z"));
    expect(agent?.scopes).toEqual([
      "openid",
      "profile",
      "offline_access",
      "email",
    ]);
  });

  it("names no session for revoked, expired or ended tokens", () => {
    for (const token of [
      { ...refresh, revoked: at("2026-11-07T11:00:00.000Z") },
      { ...refresh, expiresAt: at("2026-11-08T11:59:59.000Z") },
      { ...refresh, sessionId: null },
      { ...refresh, sessionId: "session-signed-out" },
      { ...refresh, clientId: "another-client" },
    ]) {
      const [agent] = summarizeConnectedAgents({
        grants: [grant],
        refreshTokens: [token],
        sessions: [browser],
        now,
      });
      expect(agent?.session).toBeNull();
    }
  });

  it("takes the newest live refresh token's session", () => {
    const [agent] = summarizeConnectedAgents({
      grants: [grant],
      refreshTokens: [
        refresh,
        {
          ...refresh,
          sessionId: "session-safari",
          createdAt: at("2026-11-08T10:00:00.000Z"),
        },
      ],
      sessions: [
        browser,
        { id: "session-safari", userAgent: null, createdAt: now },
      ],
      now,
    });
    expect(agent?.session).toMatchObject({
      id: "session-safari",
      current: false,
    });
  });

  it("reads lists Better Auth stored as JSON text", () => {
    const [agent] = summarizeConnectedAgents({
      grants: [
        {
          ...grant,
          redirectUris: JSON.stringify(["https://claude.ai/cb"]),
          scopes: JSON.stringify(["openid", "email"]),
        },
      ],
      refreshTokens: [],
      sessions: [],
      now,
    });
    expect(agent).toMatchObject({
      host: "claude.ai",
      scopes: ["openid", "email"],
    });
  });

  it("tolerates missing names and malformed stored JSON", () => {
    const [agent] = summarizeConnectedAgents({
      grants: [
        { ...grant, name: "   ", redirectUris: "nope", uri: null, scopes: 7 },
      ],
      refreshTokens: [],
      sessions: [],
      now,
    });
    expect(agent).toMatchObject({ name: null, host: null, scopes: [] });
  });
});

describe("agentHost", () => {
  it("prefers the first redirect URI and falls back to the client URI", () => {
    expect(agentHost(["https://claude.ai/cb"], "https://other.test")).toBe(
      "claude.ai"
    );
    expect(agentHost(["not a url"], "https://anthropic.com/claude")).toBe(
      "anthropic.com"
    );
    expect(agentHost([], null)).toBeNull();
  });
});

describe("consentCoversToken", () => {
  const consentedAt = at("2026-11-08T12:00:00.000Z");
  it("covers tokens issued in or after the consent's second", () => {
    expect(consentCoversToken(consentedAt, consentedAt.getTime() / 1000)).toBe(
      true
    );
    expect(
      consentCoversToken(
        at("2026-11-08T12:00:00.700Z"),
        consentedAt.getTime() / 1000
      )
    ).toBe(true);
    expect(
      consentCoversToken(consentedAt, consentedAt.getTime() / 1000 + 60)
    ).toBe(true);
  });
  it("refuses tokens from before the consent, and a missing iat", () => {
    expect(
      consentCoversToken(consentedAt, consentedAt.getTime() / 1000 - 1)
    ).toBe(false);
    expect(consentCoversToken(consentedAt, Number.NaN)).toBe(false);
  });
});
