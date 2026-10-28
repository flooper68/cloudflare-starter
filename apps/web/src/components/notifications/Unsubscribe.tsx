import { UnsubscribeCard, type UnsubscribeState } from "@cloudflare-starter/ui";

export interface UnsubscribeProps {
  readonly token: string;
  readonly state: UnsubscribeState;
  readonly topic: string | null;
}

/**
 * The unsubscribe page's island: the button POSTs the RFC 8058 one-click body to the
 * same endpoint mail clients use.
 */
export function Unsubscribe({ token, state, topic }: UnsubscribeProps) {
  return (
    <UnsubscribeCard
      state={state}
      topic={topic}
      onConfirm={async () => {
        const response = await fetch(
          `/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "List-Unsubscribe=One-Click",
          }
        );
        if (!response.ok) {
          const problem = (await response.json().catch(() => null)) as {
            detail?: string;
          } | null;
          throw new Error(
            problem?.detail ?? "Unsubscribing failed. Try again in a minute."
          );
        }
      }}
    />
  );
}
