import {
  Button,
  ErrorState,
  SkeletonText,
  UpgradePrompt,
} from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trialNotice, trialUpgradeOptions } from "@/lib/billing-prompts";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { useUpgrade } from "./use-upgrade";

/**
 * The app shell's trial banner: a trial ending within 7 days, or one that ended in the
 * last 7 days on a known fallback plan. Loading and failed checks remain visible,
 * with a retry; absence of a trial notice is a successful empty result.
 */
export function TrialBanner() {
  const { billing } = useAuth();
  const { active } = useWorkspace();
  const upgrade = useUpgrade();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const workspaceId = active?.id;
  const summary = useAsync(
    () =>
      billing.mode === "off" || !workspaceId
        ? Promise.resolve(null)
        : trpc.workspace.billing.summary.query({ workspaceId }),
    `${billing.mode}:${workspaceId ?? ""}`
  );

  if (billing.mode === "off" || !workspaceId || dismissed === workspaceId)
    return null;
  if (summary.status === "pending") {
    return (
      <div
        role="status"
        aria-label="Loading billing status"
        aria-busy="true"
        className="border-b border-line px-4 py-3"
      >
        <SkeletonText lines={2} className="max-w-md" />
      </div>
    );
  }
  if (summary.status === "error") {
    return (
      <ErrorState
        variant="inline"
        description="Couldn't check your trial status."
        onRetry={summary.refetch}
      />
    );
  }
  const data = summary.data;
  if (!data) return null;
  const reason = trialNotice(data, new Date());
  if (!reason) return null;

  return (
    <UpgradePrompt
      variant="banner"
      reason={reason}
      mode={upgrade.mode}
      canUpgrade={upgrade.canUpgrade}
      options={trialUpgradeOptions()}
      onUpgrade={(option) => upgrade.onUpgrade(option, data.planId)}
      onDismiss={() => setDismissed(workspaceId)}
      extraActions={
        <Button asChild size="xs" variant="ghost">
          <Link to="/app/billing">View plan</Link>
        </Button>
      }
    />
  );
}
