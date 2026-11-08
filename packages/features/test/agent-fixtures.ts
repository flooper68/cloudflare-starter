import { env } from "cloudflare:workers";

/** Inserts an OAuth client (Better Auth's `oauth_client`) unless it exists. */
export async function seedOAuthClient(
  clientId: string,
  name: string | null = "Claude",
  redirectUri = "https://claude.ai/api/mcp/auth_callback"
) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO oauth_client (id, client_id, name, redirect_uris, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      `row-${clientId}`,
      clientId,
      name,
      JSON.stringify([redirectUri]),
      Date.now(),
      Date.now()
    )
    .run();
}

/** Inserts a browser session of the user. */
export async function seedSession(
  userId: string,
  sessionId: string,
  userAgent: string | null = "Chrome on macOS",
  createdAt = Date.now()
) {
  await env.DB.prepare(
    "INSERT INTO session (id, token, user_id, user_agent, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      sessionId,
      `session-secret-${sessionId}`,
      userId,
      userAgent,
      createdAt,
      createdAt,
      createdAt + 7 * 86_400_000
    )
    .run();
}

/**
 * A connection as the consent flow leaves it: the client, the user's consent and, with
 * `sessionId`, a refresh token and a stored access token bound to that session.
 */
export async function seedAgentGrant(input: {
  readonly userId: string;
  readonly clientId: string;
  readonly name?: string | null;
  readonly sessionId?: string | null;
  readonly consentedAt?: number;
  readonly scopes?: readonly string[];
}) {
  const consentedAt = input.consentedAt ?? Date.now() - 60_000;
  const scopes = JSON.stringify(input.scopes ?? ["openid", "offline_access"]);
  await seedOAuthClient(input.clientId, input.name ?? "Claude");
  const suffix = `${input.userId}-${input.clientId}`;
  await env.DB.prepare(
    "INSERT INTO oauth_consent (id, client_id, user_id, scopes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      `consent-${suffix}`,
      input.clientId,
      input.userId,
      scopes,
      consentedAt,
      consentedAt
    )
    .run();
  if (input.sessionId === undefined) return;
  await env.DB.prepare(
    "INSERT INTO oauth_refresh_token (id, token, client_id, session_id, user_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      `refresh-${suffix}`,
      `refresh-secret-${suffix}`,
      input.clientId,
      input.sessionId,
      input.userId,
      Date.now() + 30 * 86_400_000,
      consentedAt,
      scopes
    )
    .run();
  await env.DB.prepare(
    "INSERT INTO oauth_access_token (id, token, client_id, session_id, user_id, refresh_id, expires_at, created_at, scopes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      `access-${suffix}`,
      `access-secret-${suffix}`,
      input.clientId,
      input.sessionId,
      input.userId,
      `refresh-${suffix}`,
      Date.now() + 3_600_000,
      consentedAt,
      scopes
    )
    .run();
}
