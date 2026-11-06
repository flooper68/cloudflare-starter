import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "./empty-state";

export interface NoAccessStateProps {
  /** Who may open it, as a sentence ("Workspace settings are for workspace owners."). */
  readonly reason?: string;
  /** People who can grant access (the workspace's owners), by name. */
  readonly grantedBy?: readonly string[];
  /** The workspace it belongs to. */
  readonly workspaceName?: string;
  /** The way out, usually a link back to the dashboard. */
  readonly action?: ReactNode;
  readonly variant?: "page" | "compact";
  readonly className?: string;
}

function names(people: readonly string[]): string {
  if (people.length <= 1) return people[0] ?? "";
  return `${people.slice(0, -1).join(", ")} or ${people.at(-1)}`;
}

/**
 * The 403 view: the signed-in user may not open this (their role lacks the permission).
 * Says who may, and who can grant access, so the user knows whom to ask. Use it for
 * pages and for data views whose request answered FORBIDDEN; a plan limit is not a
 * missing permission (use UpgradePrompt).
 */
export function NoAccessState({
  reason,
  grantedBy = [],
  workspaceName,
  action,
  variant = "page",
  className,
}: NoAccessStateProps) {
  const who = reason ? `${reason} ` : "";
  const ask =
    grantedBy.length > 0
      ? `Ask ${names(grantedBy)}${workspaceName ? `, ${grantedBy.length > 1 ? "owners" : "the owner"} of ${workspaceName},` : ""} if you need it.`
      : `Ask an owner${workspaceName ? ` of ${workspaceName}` : ""} if you need it.`;
  return (
    <EmptyState
      role="region"
      aria-label="No access"
      variant={variant}
      className={className}
      icon={<Lock />}
      title="You don't have access to this"
      description={`${who}${ask}`}
      primaryAction={action}
    />
  );
}
