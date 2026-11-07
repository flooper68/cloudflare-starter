import { Button, NoAccessState } from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";
import { useWorkspace } from "./workspace-context";

/**
 * The app's 403: the active workspace's role may not open this. Names the workspace's
 * owners, who can change the role (loaded with `members.read`, which every member has;
 * "an owner" while they load or if that fails), and leads back to the dashboard.
 */
export function NoAccess({
  reason,
  variant = "page",
}: {
  /** Who may open it ("Workspace settings are for workspace owners."). */
  readonly reason?: string;
  readonly variant?: "page" | "compact";
}) {
  const { active } = useWorkspace();
  const workspaceId = active?.id ?? "";
  const members = useAsync(
    () =>
      workspaceId
        ? trpc.workspace.members.list.query({ workspaceId })
        : Promise.resolve({ items: [] }),
    `owners:${workspaceId}`
  );
  const owners =
    members.data?.items
      .filter((member) => member.role === "owner")
      .map((member) => member.name) ?? [];
  return (
    <NoAccessState
      variant={variant}
      reason={reason}
      grantedBy={owners}
      workspaceName={active?.name}
      action={
        <Button asChild variant="secondary">
          <Link to="/app/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
