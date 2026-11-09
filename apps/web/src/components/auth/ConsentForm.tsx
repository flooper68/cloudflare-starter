import { hydrationGated, OAuthConsentCard } from "@cloudflare-starter/ui";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { describeScopes, REVOKE_HINT } from "@/lib/oauth-scopes";

interface PublicClient {
  readonly client_name?: string;
}

function hostOf(url: string | null): string {
  try {
    return url ? new URL(url).host : "?";
  } catch {
    return "?";
  }
}

/**
 * OAuth consent for MCP clients (e.g. Claude) that registered themselves. The
 * query is the server-signed authorization request; the client plugin sends it
 * back with the decision.
 */
function ConsentFormView({
  clientId,
  redirectUri,
  scope,
  accountEmail,
}: {
  readonly clientId: string;
  readonly redirectUri: string | null;
  readonly scope: string;
  readonly accountEmail?: string;
}) {
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    void fetch(
      `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
      { credentials: "include" }
    )
      .then((response) =>
        response.ok ? (response.json() as Promise<PublicClient>) : null
      )
      .then((client: PublicClient | null) =>
        setClientName(client?.client_name ?? null)
      )
      .catch(() => setClientName(null));
  }, [clientId]);

  async function decide(accept: boolean) {
    const result = await authClient.oauth2.consent({ accept });
    const target = (result.data as { url?: string } | null)?.url;
    if (result.error || !target) {
      throw new Error(
        result.error?.message ?? "The decision could not be saved."
      );
    }
    window.location.assign(target);
  }

  return (
    <OAuthConsentCard
      clientName={clientName ?? clientId}
      returnHost={hostOf(redirectUri)}
      accountEmail={accountEmail}
      permissions={describeScopes(scope)}
      revokeHint={REVOKE_HINT}
      onDecide={decide}
    />
  );
}

/** The `client:load` island: its buttons wait for hydration (HydrationGate). */
export const ConsentForm = hydrationGated(ConsentFormView);
