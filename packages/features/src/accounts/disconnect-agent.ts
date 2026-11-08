import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "./accounts.schema";
import { AgentNotFoundError } from "./domain";

/**
 * Disconnects one agent from the user: deletes that client's refresh tokens, stored
 * access tokens and consents for this user only, in one batch, so the agent must ask
 * again on the consent page. Its unexpired JWT access tokens are refused by `/mcp` from
 * the next request (hasAgentGrant). Better Auth has no endpoint that revokes a client's
 * tokens for a user without holding the token itself, so this writes Better Auth's tables
 * directly; recheck it when upgrading `@better-auth/oauth-provider`.
 *
 * Disconnecting the agent that is calling (MCP, `currentClientId`) is allowed: the request
 * in flight was authorized before and completes; its next request is refused.
 */
export async function disconnectAgent(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly userId: string;
    readonly clientId: string;
    readonly currentClientId?: string | null;
  }
): Promise<{ readonly disconnected: true; readonly thisConnection: boolean }> {
  const own = (table: typeof oauthConsent | typeof oauthRefreshToken) =>
    and(eq(table.userId, input.userId), eq(table.clientId, input.clientId));
  const [consents, refreshTokens, clients] = await deps.db.batch([
    deps.db
      .select({ id: oauthConsent.id })
      .from(oauthConsent)
      .where(own(oauthConsent))
      .limit(1),
    deps.db
      .select({ id: oauthRefreshToken.id })
      .from(oauthRefreshToken)
      .where(own(oauthRefreshToken))
      .limit(1),
    deps.db
      .select({ name: oauthClient.name })
      .from(oauthClient)
      .where(eq(oauthClient.clientId, input.clientId))
      .limit(1),
  ]);
  if (consents.length === 0 && refreshTokens.length === 0)
    throw new AgentNotFoundError();

  await deps.db.batch([
    deps.db
      .delete(oauthAccessToken)
      .where(
        and(
          eq(oauthAccessToken.userId, input.userId),
          eq(oauthAccessToken.clientId, input.clientId)
        )
      ),
    deps.db.delete(oauthRefreshToken).where(own(oauthRefreshToken)),
    deps.db.delete(oauthConsent).where(own(oauthConsent)),
  ]);

  const thisConnection = input.currentClientId === input.clientId;
  const clientName = clients[0]?.name?.trim().slice(0, 200);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "mcp.client.revoked",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
    metadata: {
      clientId: input.clientId.slice(0, 200),
      ...(clientName ? { clientName } : {}),
      thisConnection,
    },
  });
  return { disconnected: true, thisConnection };
}
