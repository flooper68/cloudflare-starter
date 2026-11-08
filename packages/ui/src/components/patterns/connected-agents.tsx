import { Bot, Unplug } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "../alert-dialog";
import { Badge } from "../badge";
import { Button } from "../button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import { DataState, type DataStatus } from "../data-state";
import { EmptyState } from "../empty-state";
import { Link } from "../link";
import { Skeleton } from "../skeleton";

/** One agent (an OAuth/MCP client) the person allowed to act as them. */
export interface ConnectedAgentItem {
  readonly clientId: string;
  /** The name the client registered with; it chose it itself. */
  readonly name: string | null;
  /** Where it returns to after consent, as the consent page showed it. */
  readonly host: string | null;
  readonly connectedAt: Date | string;
  /** What it may do, in the consent page's plain words. */
  readonly permissions: readonly string[];
  /** The browser session that approved it, when known. */
  readonly session: {
    readonly device: string | null;
    readonly current: boolean;
  } | null;
}

export interface ConnectedAgentsProps {
  readonly status: DataStatus;
  readonly items: readonly ConnectedAgentItem[] | undefined;
  readonly error?: unknown;
  readonly onRetry?: () => unknown;
  /** Disconnects after the person confirmed; reject to keep the row (report it yourself). */
  readonly onDisconnect: (clientId: string) => Promise<void>;
  /** The guide on connecting an agent, linked from the empty state. */
  readonly docsHref: string;
  /** Formats the connection date; defaults to the browser's medium date. */
  readonly formatDate?: (date: Date) => string;
}

const defaultFormat = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);

function nameOf(agent: ConnectedAgentItem): string {
  return agent.name ?? "Unnamed agent";
}

/** A list-shaped placeholder while the agents load. */
export function ConnectedAgentsSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label="Loading connected agents"
      className="space-y-4"
    >
      {[0, 1].map((row) => (
        <li key={row} className="flex items-start gap-3">
          <Skeleton className="size-5 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-7 w-24" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Settings › Connected agents: the AI agents (MCP clients such as Claude) the person allowed
 * on the consent page, what each may do and which browser approved it, with a Disconnect
 * button that asks first. Handles loading, error and empty itself (`DataState`).
 */
export function ConnectedAgents({
  status,
  items,
  error,
  onRetry,
  onDisconnect,
  docsHref,
  formatDate = defaultFormat,
}: ConnectedAgentsProps) {
  const [asking, setAsking] = useState<ConnectedAgentItem | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function disconnect(agent: ConnectedAgentItem) {
    setPending(agent.clientId);
    try {
      await onDisconnect(agent.clientId);
    } catch {
      // The caller reports the failure; the row stays.
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected agents</CardTitle>
        <CardDescription>
          AI agents that act as you through MCP. Disconnecting one ends its
          access at once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          status={status}
          data={items}
          error={error}
          onRetry={onRetry}
          loading={<ConnectedAgentsSkeleton />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Bot />}
              title="No agents connected"
              description="Connecting an agent such as Claude lets it use this app's tools as you. It asks on a consent page first, and every agent you allow shows up here so you can disconnect it."
              primaryAction={
                <Link href={docsHref}>How to connect an agent</Link>
              }
            />
          }
        >
          {(agents) => (
            <ul aria-label="Connected agents" className="divide-y divide-line">
              {agents.map((agent) => {
                const name = nameOf(agent);
                return (
                  <li
                    key={agent.clientId}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                  >
                    <Bot
                      aria-hidden
                      className="hidden size-5 shrink-0 text-fg-muted sm:block"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                        <span className="break-words">{name}</span>
                        {agent.session?.current ? (
                          <Badge>Approved in this browser</Badge>
                        ) : null}
                      </p>
                      <p className="break-words text-xs text-fg-muted">
                        {[
                          agent.host,
                          `Connected ${formatDate(new Date(agent.connectedAt))}`,
                          agent.session
                            ? `approved from ${agent.session.device || "an unknown browser"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <ul
                        aria-label={`What ${name} may do`}
                        className="list-disc space-y-0.5 pl-4 text-xs text-fg-muted"
                      >
                        {agent.permissions.map((permission) => (
                          <li key={permission}>{permission}</li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      size="sm"
                      icon={<Unplug />}
                      className="self-start"
                      loading={pending === agent.clientId}
                      disabled={pending !== null}
                      aria-label={`Disconnect ${name}`}
                      onClick={() => setAsking(agent)}
                    >
                      Disconnect
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DataState>
      </CardContent>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        title={`Disconnect ${asking ? nameOf(asking) : "agent"}?`}
        description={`${asking ? nameOf(asking) : "The agent"} loses access at once and must ask you again before it can act as you. Your browser sessions stay signed in.`}
        confirmLabel="Disconnect"
        tone="danger"
        onConfirm={() => {
          if (asking) void disconnect(asking);
        }}
      />
    </Card>
  );
}
