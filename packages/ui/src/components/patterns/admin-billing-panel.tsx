import { CreditCard } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "../badge";
import { Button } from "../button";
import { Callout } from "../callout";
import { Card } from "../card";
import { Checkbox } from "../checkbox";
import { Field } from "../field";
import { Input } from "../input";
import { NumberInput } from "../number-input";
import { Select, SelectGroup, SelectItem, SelectLabel } from "../select";
import { Skeleton, SkeletonText } from "../skeleton";
import { formatBytes, UsageMeter, UsageMeterSkeleton } from "../usage-meter";
import { PlanCard, type PlanStatus } from "./plan-card";

const MIB = 1024 * 1024;

/** What can be assigned, with display names (the app's copy of its billing catalog). */
export interface AdminBillingCatalog {
  readonly plans: readonly { readonly id: string; readonly name: string }[];
  readonly addons: readonly { readonly id: string; readonly name: string }[];
  readonly features: readonly {
    readonly key: string;
    readonly label: string;
  }[];
  readonly metrics: readonly {
    readonly key: string;
    readonly label: string;
    readonly unit: "bytes" | "count";
  }[];
}

export type AdminBillingOverride =
  | {
      readonly key: string;
      readonly kind: "feature";
      readonly enabled: boolean;
    }
  | {
      readonly key: string;
      readonly kind: "limit";
      /** null is unlimited. */
      readonly limit: number | null;
    };

/** One workspace's billing (`admin.billing.get`) and usage (`admin.billing.usage`). */
export interface AdminBillingData {
  readonly mode: "off" | "manual" | "provider";
  readonly planId: string;
  readonly status: PlanStatus | null;
  readonly trialEndsAt: string | null;
  readonly addons: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
  readonly overrides: readonly AdminBillingOverride[];
  /** Features in effect (plan, add-ons and overrides). */
  readonly features: readonly string[];
  readonly usage: readonly {
    readonly metric: string;
    readonly used: number;
    /** null is unlimited. */
    readonly limit: number | null;
  }[];
}

export interface AdminAssignPlanInput {
  readonly planId: string;
  readonly status: "active" | "trialing";
  /** ISO 8601, with status trialing. */
  readonly trialEndsAt: string | null;
}

export interface AdminSetOverrideInput {
  readonly key: string;
  /** null removes the override. */
  readonly override:
    | { readonly kind: "feature"; readonly enabled: boolean }
    | { readonly kind: "limit"; readonly limit: number | null }
    | null;
  readonly reason: string;
}

export interface AdminBillingPanelProps {
  readonly data: AdminBillingData;
  readonly catalog: AdminBillingCatalog;
  /** Whole days until the trial ends, for the plan's badge. */
  readonly trialDaysLeft?: number | null;
  /** Each resolves true when the change was saved (the page reloads the data). */
  readonly onAssignPlan: (input: AdminAssignPlanInput) => Promise<boolean>;
  readonly onSetAddons: (
    addons: readonly { readonly addonId: string; readonly quantity: number }[]
  ) => Promise<boolean>;
  readonly onSetOverride: (input: AdminSetOverrideInput) => Promise<boolean>;
}

function limitText(
  value: number | null,
  unit: "bytes" | "count" | undefined
): string {
  if (value === null) return "Unlimited";
  return unit === "bytes" ? formatBytes(value) : value.toLocaleString("en-US");
}

/**
 * A workspace's billing in the admin portal: its plan and state, usage against its limits
 * (overridden limits marked), and forms to assign a plan (active or a trial), set
 * add-ons, and grant, revoke or limit an entitlement with a reason. With BILLING=off it
 * only says so; in provider mode it warns that the provider's next event wins.
 */
export function AdminBillingPanel({
  data,
  catalog,
  trialDaysLeft,
  onAssignPlan,
  onSetAddons,
  onSetOverride,
}: AdminBillingPanelProps) {
  if (data.mode === "off") {
    return (
      <Callout
        tone="neutral"
        title="Billing is off"
        description="With BILLING=off every workspace has every feature without limits."
      />
    );
  }

  const planName =
    catalog.plans.find((plan) => plan.id === data.planId)?.name ?? data.planId;
  const overridden = new Map(data.overrides.map((o) => [o.key, o]));
  const labelOf = (key: string) =>
    catalog.metrics.find((m) => m.key === key)?.label ??
    catalog.features.find((f) => f.key === key)?.label ??
    key;

  return (
    <section
      aria-labelledby="admin-billing-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="admin-billing-title"
          className="flex items-center gap-2 text-base font-semibold text-fg"
        >
          <CreditCard aria-hidden className="size-4 text-fg-muted" />
          Billing
        </h2>
        <Badge tone="neutral">
          {data.mode === "manual" ? "Manual billing" : "Provider billing"}
        </Badge>
      </div>
      {data.mode === "provider" ? (
        <Callout
          tone="info"
          title="The billing provider owns this subscription"
          description="An assigned plan lasts until the provider's next event for this workspace. Add-ons and overrides stay."
        />
      ) : null}

      <PlanCard
        planName={planName}
        status={data.status}
        trialDaysLeft={trialDaysLeft}
        includes={[
          ...data.features.map(labelOf),
          ...data.addons.map(
            (addon) =>
              `${catalog.addons.find((a) => a.id === addon.addonId)?.name ?? addon.addonId} × ${addon.quantity}`
          ),
        ]}
      />

      <Card className="flex flex-col gap-5">
        <h3 className="text-sm font-semibold text-fg">Usage and limits</h3>
        {data.usage.map((line) => {
          const metric = catalog.metrics.find((m) => m.key === line.metric);
          return (
            <UsageMeter
              key={line.metric}
              label={metric?.label ?? line.metric}
              unit={metric?.unit}
              used={line.used}
              limit={line.limit}
              badges={
                overridden.has(line.metric) ? (
                  <Badge tone="info" variant="outline">
                    Override
                  </Badge>
                ) : null
              }
            />
          );
        })}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AssignPlanForm data={data} catalog={catalog} onAssign={onAssignPlan} />
        <AddonsForm data={data} catalog={catalog} onSave={onSetAddons} />
      </div>
      <OverrideForm
        data={data}
        catalog={catalog}
        labelOf={labelOf}
        onSet={onSetOverride}
      />
    </section>
  );
}

function AssignPlanForm({
  data,
  catalog,
  onAssign,
}: {
  readonly data: AdminBillingData;
  readonly catalog: AdminBillingCatalog;
  readonly onAssign: AdminBillingPanelProps["onAssignPlan"];
}) {
  const [planId, setPlanId] = useState(data.planId);
  const [status, setStatus] = useState<"active" | "trialing">(
    data.status === "trialing" ? "trialing" : "active"
  );
  const [trialEnds, setTrialEnds] = useState(
    data.trialEndsAt?.slice(0, 10) ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "trialing" && !trialEnds) {
      setError("Pick the day the trial ends");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAssign({
        planId,
        status,
        trialEndsAt:
          status === "trialing"
            ? new Date(`${trialEnds}T00:00:00.000Z`).toISOString()
            : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form
        noValidate
        aria-label="Assign plan"
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-3"
      >
        <h3 className="text-sm font-semibold text-fg">Plan</h3>
        <Field label="Plan">
          <Select value={planId} onValueChange={setPlanId}>
            {catalog.plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "active" | "trialing")}
          >
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
          </Select>
        </Field>
        {status === "trialing" ? (
          <Field label="Trial ends (UTC)" error={error}>
            <Input
              type="date"
              value={trialEnds}
              onChange={(event) => setTrialEnds(event.target.value)}
            />
          </Field>
        ) : null}
        <Button type="submit" className="self-start" loading={saving}>
          Assign plan
        </Button>
      </form>
    </Card>
  );
}

function AddonsForm({
  data,
  catalog,
  onSave,
}: {
  readonly data: AdminBillingData;
  readonly catalog: AdminBillingCatalog;
  readonly onSave: AdminBillingPanelProps["onSetAddons"];
}) {
  const [quantities, setQuantities] = useState<Record<string, number | null>>(
    () =>
      Object.fromEntries(
        catalog.addons.map((addon) => [
          addon.id,
          data.addons.find((a) => a.addonId === addon.id)?.quantity ?? 0,
        ])
      )
  );
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(
        catalog.addons
          .map((addon) => ({
            addonId: addon.id,
            quantity: quantities[addon.id] ?? 0,
          }))
          .filter((addon) => addon.quantity > 0)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form
        noValidate
        aria-label="Add-ons"
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-3"
      >
        <h3 className="text-sm font-semibold text-fg">Add-ons</h3>
        {catalog.addons.map((addon) => (
          <Field key={addon.id} label={addon.name}>
            <NumberInput
              min={0}
              max={1000}
              value={quantities[addon.id] ?? 0}
              onValueChange={(value) =>
                setQuantities((current) => ({ ...current, [addon.id]: value }))
              }
            />
          </Field>
        ))}
        <Button type="submit" className="self-start" loading={saving}>
          Save add-ons
        </Button>
      </form>
    </Card>
  );
}

function OverrideForm({
  data,
  catalog,
  labelOf,
  onSet,
}: {
  readonly data: AdminBillingData;
  readonly catalog: AdminBillingCatalog;
  readonly labelOf: (key: string) => string;
  readonly onSet: AdminBillingPanelProps["onSetOverride"];
}) {
  const [key, setKey] = useState(
    catalog.metrics[0]?.key ?? catalog.features[0]?.key ?? ""
  );
  const [enabled, setEnabled] = useState("grant");
  const [limit, setLimit] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    readonly limit?: string;
    readonly reason?: string;
  }>({});
  const [saving, setSaving] = useState<"set" | "remove" | null>(null);

  const metric = catalog.metrics.find((m) => m.key === key);
  const current = data.overrides.find((o) => o.key === key);
  const bytes = metric?.unit === "bytes";

  async function save(remove: boolean) {
    const next: { limit?: string; reason?: string } = {};
    if (reason.trim().length < 3)
      next.reason = "Say why, in at least 3 characters";
    if (!remove && metric && !unlimited && limit === null)
      next.limit = "Enter a limit, or tick Unlimited";
    setErrors(next);
    if (next.limit || next.reason) return;
    setSaving(remove ? "remove" : "set");
    try {
      const saved = await onSet({
        key,
        reason: reason.trim(),
        override: remove
          ? null
          : metric
            ? {
                kind: "limit",
                limit: unlimited
                  ? null
                  : Math.round((limit ?? 0) * (bytes ? MIB : 1)),
              }
            : { kind: "feature", enabled: enabled === "grant" },
      });
      if (saved) setReason("");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <form
        noValidate
        aria-label="Override"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-fg">Overrides</h3>
          <p className="text-sm text-fg-muted">
            An override wins over the plan and add-ons: a pilot customer, a
            paused feature. Every change is in the audit log with its reason.
          </p>
        </div>
        {data.overrides.length > 0 ? (
          <ul aria-label="Current overrides" className="flex flex-col gap-1">
            {data.overrides.map((override) => {
              const unit = catalog.metrics.find(
                (m) => m.key === override.key
              )?.unit;
              return (
                <li
                  key={override.key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-fg">{labelOf(override.key)}</span>
                  <span className="text-fg-muted tabular-nums">
                    {override.kind === "feature"
                      ? override.enabled
                        ? "Granted"
                        : "Revoked"
                      : limitText(override.limit, unit)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No overrides.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entitlement">
            <Select
              value={key}
              onValueChange={(value) => {
                setKey(value);
                setErrors({});
              }}
            >
              <SelectGroup>
                <SelectLabel>Limits</SelectLabel>
                {catalog.metrics.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Features</SelectLabel>
                {catalog.features.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </Select>
          </Field>
          {metric ? (
            <div className="flex flex-col gap-2">
              <Field
                label={bytes ? "Limit (MB)" : "Limit"}
                error={errors.limit}
              >
                <NumberInput
                  min={0}
                  value={limit}
                  disabled={unlimited}
                  onValueChange={setLimit}
                />
              </Field>
              <Checkbox
                label="Unlimited"
                checked={unlimited}
                onCheckedChange={(checked) => setUnlimited(checked === true)}
              />
            </div>
          ) : (
            <Field label="Access">
              <Select value={enabled} onValueChange={setEnabled}>
                <SelectItem value="grant">Grant</SelectItem>
                <SelectItem value="revoke">Revoke</SelectItem>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Reason" error={errors.reason}>
          <Input
            value={reason}
            maxLength={200}
            placeholder="Pilot customer until March"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            loading={saving === "set"}
            disabled={saving !== null}
          >
            Set override
          </Button>
          {current ? (
            <Button
              type="button"
              loading={saving === "remove"}
              disabled={saving !== null}
              onClick={() => void save(true)}
            >
              Remove override
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

/** Loading placeholder of the billing panel. */
export function AdminBillingPanelSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading billing"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-5 w-32" />
      <Card>
        <SkeletonText lines={2} />
      </Card>
      <Card>
        <UsageMeterSkeleton />
      </Card>
    </div>
  );
}
