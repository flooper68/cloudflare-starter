import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Logo,
} from "@cloudflare-starter/ui";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

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
export function ConsentForm({
  clientId,
  redirectUri,
  scope,
}: {
  readonly clientId: string;
  readonly redirectUri: string | null;
  readonly scope: string;
}) {
  const [clientName, setClientName] = useState<string | null>(null);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setPending(accept ? "allow" : "deny");
    setError(null);
    const result = await authClient.oauth2.consent({ accept });
    const target = (result.data as { url?: string } | null)?.url;
    if (result.error || !target) {
      setError(result.error?.message ?? "The decision could not be saved.");
      setPending(null);
      return;
    }
    window.location.assign(target);
  }

  return (
    <Card className="w-full max-w-md space-y-6">
      <CardHeader>
        <Logo className="mb-3" />
        <CardTitle>Allow access?</CardTitle>
        <p className="text-sm text-fg-muted">
          <strong>{clientName ?? clientId}</strong> wants to use this app as
          you, with the same permissions you have.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-fg-muted">
          After you allow it, you are sent back to{" "}
          <strong>{hostOf(redirectUri)}</strong>. Only continue if that is the
          app you are connecting.
        </p>
        <p className="text-xs text-fg-subtle">Scopes: {scope || "none"}</p>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex gap-3">
          <Button
            disabled={pending !== null}
            onClick={() => void decide(true)}
            type="button"
          >
            {pending === "allow" ? "Allowing..." : "Allow"}
          </Button>
          <Button
            disabled={pending !== null}
            onClick={() => void decide(false)}
            type="button"
            variant="outline"
          >
            {pending === "deny" ? "Denying..." : "Deny"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
