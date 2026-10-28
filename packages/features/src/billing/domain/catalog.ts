/**
 * The billing catalog, in code: what can be sold (plans, add-ons), what a plan unlocks
 * (features) and what it limits (metrics). It is an EXAMPLE: replace the plans, prices
 * and limits with your product's (docs/guides/how-to-configure-plans-and-billing.md). A
 * new key is enforced in a use case through the BillingGate and covered by a test
 * (test/architecture/entitlements.test.ts).
 */

/** Gated capabilities. A use case calls `billing.requireFeature(workspaceId, key)`. */
export const FEATURES = {
  "files.presigned_upload": {
    description:
      "Upload straight to R2 through a presigned URL (the web app's direct upload and the create_upload_url tool)",
  },
} as const satisfies Record<string, { readonly description: string }>;

export type FeatureKey = keyof typeof FEATURES;

/**
 * How a metric is measured:
 * - `current`: the workspace's value right now, measured on demand from the owning
 *   feature's tables. `source` names the measuring function as `<feature>.<function>`
 *   (resolved in billing/measure-metric.ts).
 * - `period`: a counter in `usage_counter` per period; `reset` says when it starts over.
 *   `source` is `usage_counter`, and the owning use case calls `billing.recordUsage`.
 */
export interface Metric {
  readonly kind: "current" | "period";
  readonly source: string;
  readonly reset?: "month";
  readonly unit: "bytes" | "count";
  readonly description: string;
}

/** Limited quantities. A use case calls `billing.requireLimit(workspaceId, key, increment)`. */
export const METRICS = {
  storage_bytes: {
    kind: "current",
    source: "files.measureWorkspaceStorage",
    unit: "bytes",
    description: "Bytes stored in the workspace's files",
  },
  "files.uploads_per_month": {
    kind: "period",
    source: "usage_counter",
    reset: "month",
    unit: "count",
    description: "Files uploaded in the current calendar month (UTC)",
  },
  seats: {
    kind: "current",
    source: "workspaces.countWorkspaceSeats",
    unit: "count",
    description: "Members plus pending invitations",
  },
} as const satisfies Record<string, Metric>;

export type MetricKey = keyof typeof METRICS;

/** A limit per metric; `null` is unlimited. */
export type Limits = Readonly<Record<MetricKey, number | null>>;

export interface Plan {
  readonly id: string;
  readonly name: string;
  readonly features: readonly FeatureKey[];
  readonly limits: Limits;
  /** A new workspace on this plan starts a trial of this many days. */
  readonly trialDays?: number;
  /** Where the workspace goes when the trial ends, or a canceled or unpaid plan lapses. */
  readonly fallbackPlanId: string;
  /** Not offered to customers (checkout, upgrade options); assignable by an admin. */
  readonly internal?: boolean;
}

export interface Addon {
  readonly id: string;
  readonly name: string;
  /** Features the add-on grants. */
  readonly features?: readonly FeatureKey[];
  /** Added to the plan's limit per unit of quantity. No effect on an unlimited metric. */
  readonly limits?: Readonly<Partial<Record<MetricKey, number>>>;
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/** Everything, without limits: every workspace's plan when BILLING=off. */
export const UNLIMITED_PLAN: Plan = {
  id: "unlimited",
  name: "Unlimited",
  features: Object.keys(FEATURES) as FeatureKey[],
  limits: { storage_bytes: null, "files.uploads_per_month": null, seats: null },
  fallbackPlanId: "unlimited",
  internal: true,
};

/** Example plans. Replace with your own. */
export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    features: [],
    limits: {
      storage_bytes: 100 * MIB,
      "files.uploads_per_month": 100,
      seats: 3,
    },
    fallbackPlanId: "free",
  },
  {
    id: "pro",
    name: "Pro",
    features: ["files.presigned_upload"],
    limits: {
      storage_bytes: 10 * GIB,
      "files.uploads_per_month": 10_000,
      seats: 25,
    },
    trialDays: 14,
    fallbackPlanId: "free",
  },
  UNLIMITED_PLAN,
];

/** Example add-ons. Replace with your own. */
export const ADDONS: readonly Addon[] = [
  {
    id: "extra_storage",
    name: "Extra 10 GB",
    limits: { storage_bytes: 10 * GIB },
  },
  { id: "extra_seats", name: "5 more seats", limits: { seats: 5 } },
  {
    id: "direct_uploads",
    name: "Direct uploads",
    features: ["files.presigned_upload"],
  },
];

/** The plan a new workspace starts on (with its trial, if it has one) when billing is on. */
export const NEW_WORKSPACE_PLAN_ID = "pro";

/** The plan of a workspace without a subscription (created before billing was turned on). */
export const DEFAULT_PLAN_ID = "free";

/** Days a past-due subscription keeps its plan after its period ended before it lapses. */
export const PAST_DUE_GRACE_DAYS = 7;

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export function findAddon(id: string): Addon | undefined {
  return ADDONS.find((addon) => addon.id === id);
}

export function isFeatureKey(key: string): key is FeatureKey {
  return Object.hasOwn(FEATURES, key);
}

export function isMetricKey(key: string): key is MetricKey {
  return Object.hasOwn(METRICS, key);
}

/** The catalog's pieces, so its rules can be checked on another catalog in tests. */
export interface Catalog {
  readonly features: Readonly<Record<string, unknown>>;
  readonly metrics: Readonly<Record<string, Metric>>;
  readonly plans: readonly Plan[];
  readonly addons: readonly Addon[];
  readonly newWorkspacePlanId: string;
  readonly defaultPlanId: string;
}

export const CATALOG: Catalog = {
  features: FEATURES,
  metrics: METRICS,
  plans: PLANS,
  addons: ADDONS,
  newWorkspacePlanId: NEW_WORKSPACE_PLAN_ID,
  defaultPlanId: DEFAULT_PLAN_ID,
};

/**
 * Problems that make a catalog unusable, empty when it is valid: unique ids, fallbacks that
 * exist and have no trial of their own, every plan limiting every metric, features and
 * limits that name known keys, metrics with a source, and the two special plans present.
 */
export function validateCatalog(catalog: Catalog): string[] {
  const problems: string[] = [];
  const planIds = catalog.plans.map((plan) => plan.id);
  const addonIds = catalog.addons.map((addon) => addon.id);
  const metrics = Object.keys(catalog.metrics);
  const feature = (key: string) => Object.hasOwn(catalog.features, key);
  const metric = (key: string) => Object.hasOwn(catalog.metrics, key);

  for (const id of new Set([...planIds, ...addonIds])) {
    if ([...planIds, ...addonIds].filter((other) => other === id).length > 1)
      problems.push(`duplicate id ${id}`);
  }
  for (const [key, definition] of Object.entries(catalog.metrics)) {
    if (!definition.source.trim()) problems.push(`metric ${key} has no source`);
    if (definition.kind === "period" && !definition.reset)
      problems.push(`period metric ${key} has no reset`);
  }
  for (const plan of catalog.plans) {
    const fallback = catalog.plans.find((p) => p.id === plan.fallbackPlanId);
    if (!fallback)
      problems.push(
        `plan ${plan.id}: fallback ${plan.fallbackPlanId} is not a plan`
      );
    else if (fallback.trialDays)
      problems.push(`plan ${plan.id}: fallback ${fallback.id} has a trial`);
    if (plan.trialDays !== undefined && !(plan.trialDays > 0))
      problems.push(`plan ${plan.id}: trialDays must be positive`);
    for (const key of plan.features)
      if (!feature(key))
        problems.push(`plan ${plan.id}: unknown feature ${key}`);
    for (const key of Object.keys(plan.limits))
      if (!metric(key)) problems.push(`plan ${plan.id}: unknown metric ${key}`);
    for (const key of metrics)
      if (!Object.hasOwn(plan.limits, key))
        problems.push(
          `plan ${plan.id}: no limit for ${key} (null is unlimited)`
        );
  }
  for (const addon of catalog.addons) {
    for (const key of addon.features ?? [])
      if (!feature(key))
        problems.push(`addon ${addon.id}: unknown feature ${key}`);
    for (const key of Object.keys(addon.limits ?? {}))
      if (!metric(key))
        problems.push(`addon ${addon.id}: unknown metric ${key}`);
  }
  for (const [name, id] of [
    ["newWorkspacePlanId", catalog.newWorkspacePlanId],
    ["defaultPlanId", catalog.defaultPlanId],
  ] as const) {
    if (!planIds.includes(id)) problems.push(`${name} ${id} is not a plan`);
  }
  return problems;
}
