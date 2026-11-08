import { ConnectedAgents, toast } from "@cloudflare-starter/ui";

import { describeScopes } from "@/lib/oauth-scopes";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";
import { useFormatters } from "@/lib/use-formatters";

/** The MCP guide: what connecting an agent means and how to do it. */
const CONNECT_AGENT_DOCS = "/docs/guides/how-to-setup-mcp/#connect-claude";

/** Settings › Connected agents: the OAuth (MCP) clients the person allowed. */
export function ConnectedAgentsSettingsPage() {
  const { dateTime } = useFormatters();
  const agents = useAsync(
    () => trpc.account.agents.list.query(),
    "connected-agents"
  );
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Connected agents</h2>
      <ConnectedAgents
        status={agents.status}
        error={agents.error}
        onRetry={agents.refetch}
        docsHref={CONNECT_AGENT_DOCS}
        formatDate={dateTime}
        items={agents.data?.items.map((agent) => ({
          clientId: agent.clientId,
          name: agent.name,
          host: agent.host,
          connectedAt: agent.connectedAt,
          // The consent page's words for the same scopes.
          permissions: describeScopes(agent.scopes.join(" ")),
          session: agent.session
            ? {
                device: agent.session.userAgent,
                current: agent.session.current,
              }
            : null,
        }))}
        onDisconnect={async (clientId) => {
          try {
            await trpc.account.agents.disconnect.mutate({ clientId });
            await agents.refetch();
            toast.success("Agent disconnected");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "The agent could not be disconnected"
            );
            throw error;
          }
        }}
      />
    </div>
  );
}
