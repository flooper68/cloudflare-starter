import {
  Button,
  Callout,
  Card,
  CardTitle,
  DataState,
  EmptyState,
  errorMessage,
  PlanCard,
  PlanCardSkeleton,
  type PlanStatus,
  toast,
  UsageMeter,
  UsageMeterSkeleton,
} from "@cloudflare-starter/ui";
import { CreditCard, ExternalLink } from "lucide-react";
import { useState } from "react";

import { useUpgrade } from "@/components/app/billing/use-upgrade";
import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import {
  addonName,
  BILLING_PLANS,
  featureLabel,
  metricOf,
} from "@/lib/billing-catalog";
import {
  formatMetric,
  periodResetLabel,
  trialDaysLeft,
} from "@/lib/billing-prompts";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/**
 * `/app/billing`: the active workspace's plan, usage against its limits, and the billing
 * actions of its mode (provider: upgrade and the customer portal for owners; manual: ask
 * the admin). Self-contained, so a settings area can mount it as one of its sections.
 */
export function BillingPage() {
  const { billing } = useAuth();
  if (billing.mode === "off") {
    return (
      <EmptyState
        icon={<CreditCard />}
        title="Billing is off"
        description="Every workspace has every feature without limits."
      />
    );
  }
  return <WorkspaceBilling />;
}

function WorkspaceBilling() {
  const { active } = useWorkspace();
  const upgrade = useUpgrade();
  const workspaceId = active?.id ?? "";
  const [opening, setOpening] = useState<string | null>(null);
  const summary = useAsync(
    () => trpc.workspace.billing.summary.query({ workspaceId }),
    `billing:${workspaceId}`
  );

  async function openPortal() {
    setOpening("portal");
    try {
      const { url } = await trpc.workspace.billing.portalUrl.mutate({
        workspaceId,
      });
      window.location.assign(url);
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't open the billing portal"));
    } finally {
      setOpening(null);
    }
  }

  async function choose(planId: string, label: string, current: string) {
    setOpening(planId);
    try {
      await upgrade.onUpgrade({ id: `plan:${planId}`, label }, current);
    } finally {
      setOpening(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-text">
          {active?.name}
        </p>
        <h2 className="text-3xl font-semibold text-fg">Billing</h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          This workspace's plan and how much of it is used.
        </p>
      </div>

      <DataState
        status={summary.status}
        data={summary.data}
        error={summary.error}
        onRetry={summary.refetch}
        isEmpty={() => false}
        loading={
          <div className="space-y-6">
            <PlanCardSkeleton />
            <Card>
              <UsageMeterSkeleton />
            </Card>
          </div>
        }
        empty={null}
      >
        {(data) => {
          const sells = data.mode === "provider" && upgrade.canUpgrade;
          const others = BILLING_PLANS.filter(
            (plan) => !plan.internal && plan.id !== data.planId
          );
          return (
            <div className="space-y-6">
              <PlanCard
                planName={data.planName}
                status={data.status as PlanStatus | null}
                trialDaysLeft={
                  data.trialEndsAt
                    ? trialDaysLeft(data.trialEndsAt, new Date())
                    : null
                }
                description={
                  data.mode === "manual"
                    ? "Your admin manages this workspace's plan."
                    : data.periodEnd
                      ? `Current period ends on ${new Date(data.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
                      : undefined
                }
                limits={data.usage.metrics.map((line) => ({
                  label: metricOf(line.metric).label,
                  value:
                    line.limit === null
                      ? "Unlimited"
                      : formatMetric(line.metric, line.limit),
                }))}
                includes={[
                  ...data.features.map(featureLabel),
                  ...data.addons.map(
                    (addon) => `${addonName(addon.addonId)} × ${addon.quantity}`
                  ),
                ]}
                actions={
                  sells ? (
                    <>
                      {others.map((plan) => (
                        <Button
                          key={plan.id}
                          size="sm"
                          variant="primary"
                          loading={opening === plan.id}
                          disabled={opening !== null}
                          onClick={() =>
                            void choose(
                              plan.id,
                              `Switch to ${plan.name}`,
                              data.planId
                            )
                          }
                        >
                          Switch to {plan.name}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        icon={<ExternalLink />}
                        loading={opening === "portal"}
                        disabled={opening !== null}
                        onClick={() => void openPortal()}
                      >
                        Manage billing
                      </Button>
                    </>
                  ) : null
                }
              />
              {data.mode === "manual" ? (
                <Callout
                  tone="info"
                  title="Need more?"
                  description="Contact your admin to change this workspace's plan, add-ons or limits."
                />
              ) : !upgrade.canUpgrade ? (
                <Callout
                  tone="info"
                  title="Need more?"
                  description="Ask a workspace owner to change the plan."
                />
              ) : null}
              <Card className="space-y-5">
                <CardTitle>Usage</CardTitle>
                {data.usage.metrics.map((line) => {
                  const metric = metricOf(line.metric);
                  return (
                    <UsageMeter
                      key={line.metric}
                      label={metric.label}
                      unit={metric.unit}
                      used={line.used}
                      limit={line.limit}
                      description={
                        line.kind === "period"
                          ? `Resets on ${periodResetLabel(data.usage.period)} (UTC).`
                          : undefined
                      }
                    />
                  );
                })}
              </Card>
            </div>
          );
        }}
      </DataState>
    </section>
  );
}
