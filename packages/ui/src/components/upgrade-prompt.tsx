import { ArrowUpCircle } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "./button";
import { Banner, Callout, type CalloutTone } from "./callout";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/** Why the prompt shows. Labels come from the app (catalog names, formatted limits). */
export type UpgradeReason =
  /** A limit was reached: `subject` is lower case ("storage", "seats"). */
  | {
      readonly kind: "limit";
      readonly subject: string;
      /** The limit, formatted ("100 MB", "3"). */
      readonly limit?: string;
    }
  /** A gated feature is not in the plan: `feature` is its name ("Direct uploads"). */
  | { readonly kind: "feature"; readonly feature: string }
  /** A trial ends soon; `daysLeft` 0 is today. */
  | {
      readonly kind: "trial-ending";
      readonly planName: string;
      readonly daysLeft: number;
    }
  /** A trial has ended; `planName` is the plan the workspace is on now. */
  | { readonly kind: "trial-ended"; readonly planName: string };

/** BILLING: off hides every prompt, manual sends people to an admin, provider sells. */
export type UpgradeBillingMode = "off" | "manual" | "provider";

export interface UpgradeOption {
  readonly id: string;
  /** The button's text: "Upgrade to Pro", "Add 5 more seats". */
  readonly label: string;
}

export interface UpgradePromptProps {
  readonly reason: UpgradeReason;
  readonly mode: UpgradeBillingMode;
  /**
   * May buy (`billing.manage`, workspace owners). In provider mode the others are told to
   * ask an owner.
   */
  readonly canUpgrade?: boolean;
  /** What would lift it, best first; the first is the primary button. Provider mode only. */
  readonly options?: readonly UpgradeOption[];
  /** Starts the checkout for an option; while a returned promise runs, its button spins. */
  readonly onUpgrade?: (option: UpgradeOption) => unknown;
  /**
   * callout: inside content, next to what was refused; banner: a strip at the top of the
   * app (trials); dialog: a modal after an action was refused.
   */
  readonly variant?: "callout" | "banner" | "dialog";
  /** Dialog only. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** More actions after the upgrade buttons, e.g. a link to the billing page. */
  readonly extraActions?: ReactNode;
  /** Callout and banner: shows a × that calls this. */
  readonly onDismiss?: () => void;
  readonly className?: string;
}

function title(reason: UpgradeReason): string {
  switch (reason.kind) {
    case "limit":
      return `You've reached the ${reason.subject} limit`;
    case "feature":
      return `${reason.feature} is not included in your plan`;
    case "trial-ending":
      return reason.daysLeft <= 0
        ? `Your ${reason.planName} trial ends today`
        : `Your ${reason.planName} trial ends in ${reason.daysLeft} ${reason.daysLeft === 1 ? "day" : "days"}`;
    case "trial-ended":
      return "Your trial has ended";
  }
}

function situation(reason: UpgradeReason): string {
  switch (reason.kind) {
    case "limit":
      return reason.limit
        ? `This workspace uses all ${reason.limit} of ${reason.subject} its plan includes.`
        : `This workspace uses all the ${reason.subject} its plan includes.`;
    case "feature":
      return "This workspace's plan does not include it.";
    case "trial-ending":
      return "Choose a plan to keep its features afterwards.";
    case "trial-ended":
      return `This workspace is now on the ${reason.planName} plan.`;
  }
}

function nextStep(
  mode: UpgradeBillingMode,
  canUpgrade: boolean,
  hasOptions: boolean
): string {
  if (mode === "manual")
    return "Contact your admin to change this workspace's plan.";
  if (!canUpgrade) return "Ask a workspace owner to upgrade.";
  return hasOptions
    ? "Upgrade to continue."
    : "Contact support to change this workspace's plan.";
}

const toneOf: Record<UpgradeReason["kind"], CalloutTone> = {
  limit: "warning",
  feature: "warning",
  "trial-ending": "info",
  "trial-ended": "warning",
};

/**
 * Tells someone that their plan stops them and what to do: upgrade (BILLING=provider,
 * for those who may buy), ask an owner, or contact the admin (BILLING=manual). For a
 * reached limit, a feature not in the plan, a trial ending soon and a trial that ended.
 * Renders nothing with BILLING=off. Variants: callout, banner, dialog.
 */
export function UpgradePrompt({
  reason,
  mode,
  canUpgrade = false,
  options = [],
  onUpgrade,
  variant = "callout",
  open,
  onOpenChange,
  extraActions,
  onDismiss,
  className,
}: UpgradePromptProps) {
  const [pending, setPending] = useState<string | null>(null);
  if (mode === "off") return null;

  const sells = mode === "provider" && canUpgrade && options.length > 0;
  const heading = title(reason);
  const body = `${situation(reason)} ${nextStep(mode, canUpgrade, options.length > 0)}`;

  async function upgrade(option: UpgradeOption) {
    setPending(option.id);
    try {
      await onUpgrade?.(option);
    } finally {
      setPending(null);
    }
  }

  const buttons = sells
    ? options.map((option, index) => (
        <Button
          key={option.id}
          size={variant === "dialog" ? "md" : "xs"}
          variant={index === 0 ? "primary" : "secondary"}
          icon={index === 0 ? <ArrowUpCircle /> : undefined}
          loading={pending === option.id}
          disabled={pending !== null && pending !== option.id}
          onClick={() => void upgrade(option)}
        >
          {option.label}
        </Button>
      ))
    : null;

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm" className={className}>
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap">
            {extraActions}
            <DialogClose asChild>
              <Button variant={sells ? "ghost" : "primary"}>
                {sells ? "Not now" : "OK"}
              </Button>
            </DialogClose>
            {buttons}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const Notice = variant === "banner" ? Banner : Callout;
  const actions =
    buttons || extraActions ? (
      <>
        {buttons}
        {extraActions}
      </>
    ) : undefined;
  return (
    <Notice
      tone={toneOf[reason.kind]}
      title={heading}
      description={body}
      actions={actions}
      onDismiss={onDismiss}
      className={className}
    />
  );
}
