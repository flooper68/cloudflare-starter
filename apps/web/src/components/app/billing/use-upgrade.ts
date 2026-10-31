import {
  errorMessage,
  toast,
  type UpgradeOption,
} from "@cloudflare-starter/ui";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { checkoutInputFor } from "@/lib/billing-prompts";
import { trpc } from "@/lib/trpc/client";

export interface Upgrade {
  /** BILLING, from the page's bootstrap. */
  readonly mode: "off" | "manual" | "provider";
  /** Owners may buy (`billing.manage`); the others are told to ask one. */
  readonly canUpgrade: boolean;
  /** Opens the provider's checkout for an option; a failure is a toast. */
  readonly onUpgrade: (
    option: UpgradeOption,
    currentPlanId: string
  ) => Promise<void>;
}

/** What every upgrade prompt of the app needs: the mode, who may buy, and the checkout. */
export function useUpgrade(): Upgrade {
  const { billing } = useAuth();
  const { active } = useWorkspace();

  async function onUpgrade(option: UpgradeOption, currentPlanId: string) {
    try {
      const input = checkoutInputFor(option.id, currentPlanId);
      const { url } = await trpc.workspace.billing.checkoutUrl.mutate({
        workspaceId: active?.id,
        planId: input.planId,
        addons: [...input.addons],
      });
      window.location.assign(url);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't open the checkout"));
    }
  }

  return {
    mode: billing.mode,
    canUpgrade: active?.role === "owner",
    onUpgrade,
  };
}
