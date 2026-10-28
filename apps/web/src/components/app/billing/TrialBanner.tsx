import { Button, UpgradePrompt } from "@cloudflare-starter/ui";
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
 * last 7 days. Dismissible per workspace until the next page load. A notice, not a view:
 * while the summary loads or when it fails it shows nothing (the billing page reports
 * errors).
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

  const data = summary.data;
  if (!data || !workspaceId || dismissed === workspaceId) return null;
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
