import {
  type AdminBillingCatalog,
  type AdminBillingData,
  type AdminBillingOverride,
  AdminBillingPanel,
  AdminBillingPanelSkeleton,
  DataState,
  type PlanStatus,
} from "@cloudflare-starter/ui";

import {
  BILLING_ADDONS,
  BILLING_FEATURES,
  BILLING_METRICS,
  BILLING_PLANS,
} from "@/lib/billing-catalog";
import { trialDaysLeft } from "@/lib/billing-prompts";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { useAdminAction } from "./use-admin-action";

/** Every plan (internal ones too: an admin may assign them), add-on, feature and metric. */
const catalog: AdminBillingCatalog = {
  plans: BILLING_PLANS.map((plan) => ({ id: plan.id, name: plan.name })),
  addons: BILLING_ADDONS,
  features: Object.entries(BILLING_FEATURES).map(([key, feature]) => ({
    key,
    label: feature.label,
  })),
  metrics: Object.entries(BILLING_METRICS).map(([key, metric]) => ({
    key,
    label: metric.label,
    unit: metric.unit,
  })),
};

/**
 * The admin workspace page's Billing panel: plan, add-ons, overrides and usage against
 * limits, from `admin.billing.get` and `admin.billing.usage`; changes go through
 * `admin.billing.assignPlan`, `setAddons` and `setOverride` (each audited by the server).
 */
export function WorkspaceBilling({
  workspaceId,
}: {
  readonly workspaceId: string;
}) {
  const { run, dialog } = useAdminAction();
  const data = useAsync(async (): Promise<AdminBillingData> => {
    const [billing, usage] = await Promise.all([
      trpc.admin.billing.get.query({ workspaceId }),
      trpc.admin.billing.usage.query({ workspaceId }),
    ]);
    return {
      mode: billing.mode,
      planId: billing.planId,
      status: billing.status as PlanStatus | null,
      trialEndsAt: billing.trialEndsAt,
      addons: billing.addons,
      overrides: billing.overrides as readonly AdminBillingOverride[],
      features: billing.entitlements.features,
      usage: usage.metrics,
    };
  }, `billing:${workspaceId}`);

  async function change(action: () => Promise<unknown>, done: string) {
    const ok = await run(action, done);
    if (ok) await data.refetch();
    return ok;
  }

  return (
    <>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        isEmpty={() => false}
        loading={<AdminBillingPanelSkeleton />}
        empty={null}
      >
        {(billing) => (
          <AdminBillingPanel
            data={billing}
            catalog={catalog}
            trialDaysLeft={
              billing.trialEndsAt
                ? trialDaysLeft(billing.trialEndsAt, new Date())
                : null
            }
            onAssignPlan={(input) =>
              change(
                () =>
                  trpc.admin.billing.assignPlan.mutate({
                    workspaceId,
                    ...input,
                  }),
                "Plan assigned"
              )
            }
            onSetAddons={(addons) =>
              change(
                () =>
                  trpc.admin.billing.setAddons.mutate({
                    workspaceId,
                    addons: [...addons],
                  }),
                "Add-ons saved"
              )
            }
            onSetOverride={(input) =>
              change(
                () =>
                  trpc.admin.billing.setOverride.mutate({
                    workspaceId,
                    key: input.key,
                    override: input.override,
                    reason: input.reason,
                  }),
                input.override ? "Override set" : "Override removed"
              )
            }
          />
        )}
      </DataState>
      {dialog}
    </>
  );
}
