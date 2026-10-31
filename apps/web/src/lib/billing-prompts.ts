/**
 * Turns billing refusals and trial dates into UpgradePrompt props (packages/ui
 * upgrade-prompt.tsx). A refusal reaches the browser as a tRPC error (`data.appCode`,
 * `data.domain = { kind: "limit_reached", details }`) or as a Problem Details body from an
 * HTTP route (`kind`, `code` and the details as members);
 * docs/guides/how-to-configure-plans-and-billing.md#what-a-refusal-looks-like.
 */
import {
  formatBytes,
  type UpgradeOption,
  type UpgradeReason,
} from "@cloudflare-starter/ui";

import {
  addonName,
  BILLING_PLANS,
  featureLabel,
  metricOf,
  planName,
} from "./billing-catalog";

export const LIMIT_CODES = ["LIMIT_REACHED", "FEATURE_NOT_INCLUDED"] as const;

/** A plan refused an action: what, at which limit, and what would lift it. */
export interface LimitRefusal {
  readonly code: (typeof LIMIT_CODES)[number];
  /** LIMIT_REACHED: the metric and its numbers. */
  readonly metric?: string;
  readonly limit?: number;
  readonly current?: number;
  /** FEATURE_NOT_INCLUDED: the feature. */
  readonly feature?: string;
  /** The workspace's plan when it was refused. */
  readonly planId?: string;
  readonly upgrade: {
    readonly planIds: readonly string[];
    readonly addonIds: readonly string[];
  };
}

type Loose = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Loose {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function fromDetails(code: unknown, details: unknown): LimitRefusal | null {
  if (!LIMIT_CODES.includes(code as LimitRefusal["code"])) return null;
  if (!isObject(details)) return null;
  const upgrade = isObject(details.upgrade) ? details.upgrade : {};
  const number = (key: string) =>
    typeof details[key] === "number" ? (details[key] as number) : undefined;
  const text = (key: string) =>
    typeof details[key] === "string" ? (details[key] as string) : undefined;
  return {
    code: code as LimitRefusal["code"],
    metric: text("metric"),
    limit: number("limit"),
    current: number("current"),
    feature: text("feature"),
    planId: text("planId"),
    upgrade: {
      planIds: strings(upgrade.planIds),
      addonIds: strings(upgrade.addonIds),
    },
  };
}

/**
 * The refusal in a failed call, or null when the failure is something else: a tRPC
 * client error (`error.data.appCode` and `error.data.domain`) or a parsed Problem Details
 * body of `/api/files` (`kind: "limit_reached"`, `code`, details as members).
 */
export function limitRefusalOf(error: unknown): LimitRefusal | null {
  if (!isObject(error)) return null;
  if (isObject(error.data)) {
    const { appCode, domain } = error.data;
    if (isObject(domain) && domain.kind === "limit_reached")
      return fromDetails(appCode, domain.details);
    return null;
  }
  if (error.kind === "limit_reached") return fromDetails(error.code, error);
  return null;
}

/** A metric's value as people read it: "100 MB", "3". */
export function formatMetric(metric: string, value: number): string {
  return metricOf(metric).unit === "bytes"
    ? formatBytes(value)
    : value.toLocaleString("en-US");
}

/** Button ids: `plan:<id>` buys a plan, `addon:<id>` one unit of an add-on. */
export function upgradeOptions(
  upgrade: LimitRefusal["upgrade"]
): UpgradeOption[] {
  return [
    ...upgrade.planIds.map((id) => ({
      id: `plan:${id}`,
      label: `Upgrade to ${planName(id)}`,
    })),
    ...upgrade.addonIds.map((id) => ({
      id: `addon:${id}`,
      label: `Add ${addonName(id)}`,
    })),
  ];
}

/** The reason and the options of an UpgradePrompt for a refusal. */
export function upgradePromptFor(refusal: LimitRefusal): {
  readonly reason: UpgradeReason;
  readonly options: UpgradeOption[];
} {
  const reason: UpgradeReason =
    refusal.code === "FEATURE_NOT_INCLUDED"
      ? { kind: "feature", feature: featureLabel(refusal.feature ?? "") }
      : {
          kind: "limit",
          subject: metricOf(refusal.metric ?? "").subject,
          limit:
            refusal.limit === undefined || refusal.metric === undefined
              ? undefined
              : formatMetric(refusal.metric, refusal.limit),
        };
  return { reason, options: upgradeOptions(refusal.upgrade) };
}

/**
 * `workspace.billing.checkoutUrl`'s input for an option: a plan, or the current plan with
 * one unit of an add-on.
 */
export function checkoutInputFor(
  optionId: string,
  currentPlanId: string
): {
  readonly planId: string;
  readonly addons: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
} {
  const colon = optionId.indexOf(":");
  const kind = optionId.slice(0, colon);
  const id = optionId.slice(colon + 1);
  return kind === "addon"
    ? { planId: currentPlanId, addons: [{ addonId: id, quantity: 1 }] }
    : { planId: id, addons: [] };
}

const DAY = 86_400_000;
/** How long before its end a trial is announced, and after it the end is. */
export const TRIAL_NOTICE_DAYS = 7;

/** Whole days until `trialEndsAt` (0: less than a day, or past). */
export function trialDaysLeft(trialEndsAt: string, now: Date): number {
  const left = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(left / DAY));
}

/** When the counters of a usage period (`YYYY-MM`) start over: "1 December". */
export function periodResetLabel(period: string): string {
  const [year = 0, month = 1] = period.split("-").map(Number);
  // Date.UTC's month is 0-based, so the 1-based `month` is the next month.
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * The trial banner of the app shell, or null: a trial ending within 7 days (whole days
 * left, 0 is today), or a trial that ended within the last 7 days and left the workspace
 * on a known trial fallback plan. A retained trial date on any other paid or internal
 * plan is not evidence that its features lapsed.
 */
export function trialNotice(
  billing: {
    readonly mode: "off" | "manual" | "provider";
    readonly planId: string;
    readonly planName: string;
    readonly status: string | null;
    readonly trialEndsAt: string | null;
  },
  now: Date
): UpgradeReason | null {
  if (billing.mode === "off" || !billing.trialEndsAt) return null;
  const left = new Date(billing.trialEndsAt).getTime() - now.getTime();
  if (billing.status === "trialing") {
    if (left > TRIAL_NOTICE_DAYS * DAY) return null;
    return {
      kind: "trial-ending",
      planName: billing.planName,
      daysLeft: trialDaysLeft(billing.trialEndsAt, now),
    };
  }
  const onTrialFallback = BILLING_PLANS.some(
    (plan) => plan.trial && plan.fallbackPlanId === billing.planId
  );
  if (
    billing.status === "active" &&
    left <= 0 &&
    -left <= TRIAL_NOTICE_DAYS * DAY &&
    onTrialFallback
  )
    return { kind: "trial-ended", planName: billing.planName };
  return null;
}

/** Upgrade options for a trial: every customer plan with a trial of its own. */
export function trialUpgradeOptions(): UpgradeOption[] {
  return BILLING_PLANS.filter((plan) => plan.trial && !plan.internal).map(
    (plan) => ({ id: `plan:${plan.id}`, label: `Choose ${plan.name}` })
  );
}
