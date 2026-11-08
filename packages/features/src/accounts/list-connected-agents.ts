import { and, eq, gt, inArray } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
} from "./accounts.schema";
import { type ConnectedAgent, summarizeConnectedAgents } from "./domain";

/**
 * The OAuth (MCP) clients the user allowed, newest first, with the scopes and the
 * approving browser session. Reads only the user's own rows and never token values.
 */
export async function listConnectedAgents(
  deps: { readonly db: Database; readonly clock: Clock },
  input: {
    readonly userId: string;
    /** The browser asking, to mark its session. */
    readonly currentSessionId?: string | null;
    /** The MCP client asking, to mark its own connection. */
    readonly currentClientId?: string | null;
  }
): Promise<ConnectedAgent[]> {
  const now = deps.clock.now();
  const grants = await deps.db
    .select({
      clientId: oauthConsent.clientId,
      name: oauthClient.name,
      uri: oauthClient.uri,
      redirectUris: oauthClient.redirectUris,
      consentedAt: oauthConsent.createdAt,
      scopes: oauthConsent.scopes,
    })
    .from(oauthConsent)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(eq(oauthConsent.userId, input.userId));
  if (grants.length === 0) return [];

  const clientIds = [...new Set(grants.map((grant) => grant.clientId))];
  const [refreshTokens, sessions] = await deps.db.batch([
    deps.db
      .select({
        clientId: oauthRefreshToken.clientId,
        sessionId: oauthRefreshToken.sessionId,
        createdAt: oauthRefreshToken.createdAt,
        expiresAt: oauthRefreshToken.expiresAt,
        revoked: oauthRefreshToken.revoked,
      })
      .from(oauthRefreshToken)
      .where(
        and(
          eq(oauthRefreshToken.userId, input.userId),
          inArray(oauthRefreshToken.clientId, clientIds),
          gt(oauthRefreshToken.expiresAt, now)
        )
      ),
    deps.db
      .select({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
      })
      .from(session)
      .where(and(eq(session.userId, input.userId), gt(session.expiresAt, now))),
  ]);

  return summarizeConnectedAgents({
    grants,
    refreshTokens,
    sessions,
    now,
    currentSessionId: input.currentSessionId ?? null,
    currentClientId: input.currentClientId ?? null,
  });
}
