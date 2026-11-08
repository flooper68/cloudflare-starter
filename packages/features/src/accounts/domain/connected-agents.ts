/**
 * Connected agents: the OAuth (MCP) clients a person allowed on the consent page. A
 * connection is the person's consent for that client (Better Auth's `oauth_consent`); its
 * refresh tokens, when it asked for `offline_access`, say which browser session approved it.
 * Pure rules over rows the use cases read; no I/O.
 */

/** A consent row joined with its client, as listConnectedAgents reads it. */
export interface AgentGrantRow {
  readonly clientId: string;
  readonly name: string | null;
  readonly uri: string | null;
  readonly redirectUris: unknown;
  readonly consentedAt: Date;
  readonly scopes: unknown;
}

/** A refresh token of the person for some client (never its value). */
export interface AgentRefreshTokenRow {
  readonly clientId: string;
  readonly sessionId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revoked: Date | null;
}

/** A live browser session of the person. */
export interface AgentSessionRow {
  readonly id: string;
  readonly userAgent: string | null;
  readonly createdAt: Date;
}

/** One connected agent, as the settings page, the admin portal and MCP see it. */
export interface ConnectedAgent {
  readonly clientId: string;
  /** The name the client registered with (self-asserted), or null. */
  readonly name: string | null;
  /** Where the client returns to after consent (the consent page shows the same host). */
  readonly host: string | null;
  /** When the person first allowed it (the oldest consent still on record). */
  readonly connectedAt: Date;
  /** The scopes allowed, deduplicated, in the order first granted. */
  readonly scopes: readonly string[];
  /**
   * The live browser session that approved it, known when the client holds a refresh
   * token; signing that session out also ends the agent's access.
   */
  readonly session: {
    readonly id: string;
    readonly userAgent: string | null;
    readonly signedInAt: Date;
    /** It is the browser asking. */
    readonly current: boolean;
  } | null;
  /** It is the MCP client asking (its own access token). */
  readonly thisConnection: boolean;
}

const NAME_MAX = 100;

/**
 * A list column of Better Auth's OAuth tables as read back: an array, or the JSON text of
 * one (Better Auth serializes arrays itself before the JSON column stores them).
 */
function stringsOf(value: unknown): string[] {
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return value.split(/\s+/).filter(Boolean);
    }
  }
  return Array.isArray(list)
    ? list.filter((item): item is string => typeof item === "string")
    : [];
}

/** The host of the first parseable URL, for display only (never a link). */
export function agentHost(
  redirectUris: unknown,
  uri: string | null
): string | null {
  for (const candidate of [...stringsOf(redirectUris), uri ?? ""]) {
    try {
      const host = new URL(candidate).host;
      if (host) return host;
    } catch {
      // Not a URL (a custom scheme without host, or nothing): try the next one.
    }
  }
  return null;
}

/**
 * The person's connected agents, newest first: one per client with a consent, its scopes
 * merged across consents, and the approving session taken from the newest live refresh
 * token whose session still exists.
 */
export function summarizeConnectedAgents(input: {
  readonly grants: readonly AgentGrantRow[];
  readonly refreshTokens: readonly AgentRefreshTokenRow[];
  readonly sessions: readonly AgentSessionRow[];
  readonly now: Date;
  readonly currentSessionId?: string | null;
  readonly currentClientId?: string | null;
}): ConnectedAgent[] {
  const sessions = new Map(input.sessions.map((row) => [row.id, row]));
  const byClient = new Map<
    string,
    { first: AgentGrantRow; consentedAt: Date; scopes: string[] }
  >();
  for (const grant of input.grants) {
    const entry = byClient.get(grant.clientId);
    const scopes = stringsOf(grant.scopes);
    if (!entry) {
      byClient.set(grant.clientId, {
        first: grant,
        consentedAt: grant.consentedAt,
        scopes: [...new Set(scopes)],
      });
      continue;
    }
    if (grant.consentedAt < entry.consentedAt)
      entry.consentedAt = grant.consentedAt;
    for (const scope of scopes)
      if (!entry.scopes.includes(scope)) entry.scopes.push(scope);
  }

  return [...byClient.entries()]
    .map(([clientId, entry]): ConnectedAgent => {
      const approving = input.refreshTokens
        .filter(
          (token) =>
            token.clientId === clientId &&
            token.revoked === null &&
            token.expiresAt > input.now &&
            token.sessionId !== null &&
            sessions.has(token.sessionId)
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const session = approving?.sessionId
        ? sessions.get(approving.sessionId)
        : undefined;
      const name = entry.first.name?.trim().slice(0, NAME_MAX) || null;
      return {
        clientId,
        name,
        host: agentHost(entry.first.redirectUris, entry.first.uri),
        connectedAt: entry.consentedAt,
        scopes: entry.scopes,
        session: session
          ? {
              id: session.id,
              userAgent: session.userAgent || null,
              signedInAt: session.createdAt,
              current: session.id === input.currentSessionId,
            }
          : null,
        thisConnection: clientId === input.currentClientId,
      };
    })
    .sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
}

/**
 * Whether a consent on record covers an access token issued at `issuedAtSeconds` (JWT
 * `iat`). Better Auth stores consent times in whole seconds, so a token issued in the same
 * second counts; a token issued before the consent (one from before a disconnect, when the
 * person allowed the client again later) does not.
 */
export function consentCoversToken(
  consentedAt: Date,
  issuedAtSeconds: number
): boolean {
  if (!Number.isFinite(issuedAtSeconds)) return false;
  return (
    issuedAtSeconds * 1000 >= Math.floor(consentedAt.getTime() / 1000) * 1000
  );
}
