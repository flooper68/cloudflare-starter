import { Check } from "lucide-react";
import { useState } from "react";

import { Logo } from "../../brand/brand";
import { Button } from "../button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../card";
import { errorMessage } from "../error-state";

export interface OAuthConsentCardProps {
  /** The client's registered name, or its id while the name loads. */
  readonly clientName: string;
  /** The host the user is sent back to after deciding. */
  readonly returnHost: string;
  /** Who the client will act as. */
  readonly accountEmail?: string;
  /** What the client may do, in plain words, one line per scope. */
  readonly permissions: readonly string[];
  /** Where and how the access is taken back later. */
  readonly revokeHint?: string;
  /** Saves the decision; reject with a message-bearing error to show it. */
  readonly onDecide: (accept: boolean) => Promise<void>;
}

/**
 * The OAuth consent screen an MCP client (Claude) opens: who asks, as whom, where the
 * browser goes back to, what it may do in plain words, and where to revoke it.
 */
export function OAuthConsentCard({
  clientName,
  returnHost,
  accountEmail,
  permissions,
  revokeHint,
  onDecide,
}: OAuthConsentCardProps) {
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError(null);
    try {
      await onDecide(accept);
    } catch (caught) {
      setError(errorMessage(caught, "The decision could not be saved."));
      setPending(null);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-4">
      <CardHeader>
        <Logo className="mb-3" />
        <CardTitle level={1}>Allow access?</CardTitle>
        <p className="text-sm text-fg-muted">
          <strong className="text-fg">{clientName}</strong> wants to act as{" "}
          {accountEmail ? (
            <strong className="text-fg">{accountEmail}</strong>
          ) : (
            "you"
          )}
          , with the same permissions you have. After you decide, you are sent
          back to <strong className="text-fg">{returnHost}</strong>. Only
          continue if that is the app you are connecting.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-fg-muted">It will be able to</p>
        <ul className="space-y-2" aria-label="Permissions requested">
          {permissions.map((permission) => (
            <li key={permission} className="flex gap-2 text-sm text-fg">
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-success"
              />
              <span>{permission}</span>
            </li>
          ))}
        </ul>
        {revokeHint ? (
          <p className="text-xs text-fg-muted">{revokeHint}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="primary"
          loading={pending === "allow"}
          disabled={pending !== null}
          onClick={() => void decide(true)}
        >
          Allow
        </Button>
        <Button
          loading={pending === "deny"}
          disabled={pending !== null}
          onClick={() => void decide(false)}
        >
          Deny
        </Button>
      </CardFooter>
    </Card>
  );
}
