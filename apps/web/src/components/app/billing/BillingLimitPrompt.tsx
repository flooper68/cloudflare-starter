import { Button, UpgradePrompt } from "@cloudflare-starter/ui";
import { Link } from "@tanstack/react-router";

import { type LimitRefusal, upgradePromptFor } from "@/lib/billing-prompts";

import { useUpgrade } from "./use-upgrade";

export interface BillingLimitPromptProps {
  /** From `limitRefusalOf(error)`. */
  readonly refusal: LimitRefusal;
  readonly variant?: "callout" | "dialog";
  /** Dialog only. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * The upgrade prompt for a refused action (a limit reached, a feature not in the plan):
 * upgrade in provider mode, "contact your admin" in manual mode, nothing with billing
 * off; with a link to the billing page.
 */
export function BillingLimitPrompt({
  refusal,
  variant = "callout",
  open,
  onOpenChange,
}: BillingLimitPromptProps) {
  const { mode, canUpgrade, onUpgrade } = useUpgrade();
  const { reason, options } = upgradePromptFor(refusal);
  return (
    <UpgradePrompt
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      reason={reason}
      mode={mode}
      canUpgrade={canUpgrade}
      options={options}
      onUpgrade={(option) => onUpgrade(option, refusal.planId ?? "")}
      extraActions={
        <Button
          asChild
          size={variant === "dialog" ? "md" : "xs"}
          variant="ghost"
        >
          <Link to="/app/billing">View plan and usage</Link>
        </Button>
      }
    />
  );
}
