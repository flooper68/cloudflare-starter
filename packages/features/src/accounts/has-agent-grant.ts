import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { oauthConsent } from "./accounts.schema";
import { consentCoversToken } from "./domain";

/**
 * Whether the user still allows the client an access token was issued to: a consent on
 * record that is not newer than the token (`iat`). `/mcp` asks on every request, so a
 * disconnected agent's unexpired JWT stops working at once, and a token from before a
 * disconnect stays refused after the person allows the client again.
 */
export async function hasAgentGrant(
  deps: { readonly db: Database },
  input: {
    readonly userId: string;
    readonly clientId: string;
    /** The access token's `iat`, in seconds. */
    readonly issuedAtSeconds: number;
  }
): Promise<boolean> {
  const consents = await deps.db
    .select({ consentedAt: oauthConsent.createdAt })
    .from(oauthConsent)
    .where(
      and(
        eq(oauthConsent.userId, input.userId),
        eq(oauthConsent.clientId, input.clientId)
      )
    );
  return consents.some((consent) =>
    consentCoversToken(consent.consentedAt, input.issuedAtSeconds)
  );
}
