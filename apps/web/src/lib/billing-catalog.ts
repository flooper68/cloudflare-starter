/**
 * What the browser needs of the billing catalog (packages/features/src/billing/domain/catalog.ts):
 * plan and add-on names, and the words the UI uses for features and metrics. A copy, so the
 * browser bundle does not pull in the server package; billing-catalog.test.ts fails when
 * ids, names, units or trials drift from the catalog. Change the wording here to customise
 * the billing page and upgrade prompts (docs/guides/how-to-configure-plans-and-billing.md).
 */

export interface ClientPlan {
  readonly id: string;
  readonly name: string;
  /** Not offered to customers (never an upgrade option or a checkout). */
  readonly internal?: boolean;
  /** The plan starts with a trial (a workspace on it may be trialing). */
  readonly trial?: boolean;
}

export const BILLING_PLANS: readonly ClientPlan[] = [
  { id: "free", name: "Free" },
  { id: "pro", name: "Pro", trial: true },
  { id: "unlimited", name: "Unlimited", internal: true },
];

export const BILLING_ADDONS: readonly {
  readonly id: string;
  readonly name: string;
}[] = [
  { id: "extra_storage", name: "Extra 10 GB" },
  { id: "extra_seats", name: "5 more seats" },
  { id: "direct_uploads", name: "Direct uploads" },
];

export interface ClientMetric {
  /** Title case, for meters and lists: "Storage". */
  readonly label: string;
  /** Lower case, inside sentences: "You've reached the storage limit". */
  readonly subject: string;
  readonly unit: "bytes" | "count";
}

export const BILLING_METRICS: Readonly<Record<string, ClientMetric>> = {
  storage_bytes: { label: "Storage", subject: "storage", unit: "bytes" },
  "files.uploads_per_month": {
    label: "Uploads this month",
    subject: "monthly uploads",
    unit: "count",
  },
  seats: { label: "Seats", subject: "seats", unit: "count" },
};

export const BILLING_FEATURES: Readonly<
  Record<string, { readonly label: string }>
> = {
  "files.presigned_upload": { label: "Direct uploads" },
};

export function planName(id: string): string {
  return BILLING_PLANS.find((plan) => plan.id === id)?.name ?? id;
}

export function addonName(id: string): string {
  return BILLING_ADDONS.find((addon) => addon.id === id)?.name ?? id;
}

export function metricOf(key: string): ClientMetric {
  return BILLING_METRICS[key] ?? { label: key, subject: key, unit: "count" };
}

export function featureLabel(key: string): string {
  return BILLING_FEATURES[key]?.label ?? key;
}
