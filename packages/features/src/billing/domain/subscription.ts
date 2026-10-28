import { z } from "zod";

/** Where a workspace's subscription stands. */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Who manages a subscription: an admin ("manual") or a provider adapter's name. */
export const MANUAL_PROVIDER = "manual";

const id = z.string().min(1).max(200);
const catalogId = z.string().min(1).max(100);

export const addonGrantSchema = z.object({
  addonId: catalogId,
  quantity: z.number().int().min(1).max(1000),
});

/** Add-ons with their quantity, each at most once. */
const uniqueAddons = z
  .array(addonGrantSchema)
  .max(50)
  .refine(
    (addons) => new Set(addons.map((a) => a.addonId)).size === addons.length,
    { message: "Each add-on at most once" }
  );

/**
 * A provider's subscription event, normalized by its adapter (BillingProvider.parseWebhook)
 * and applied by applySubscriptionChange. `addons`, when given, replaces the workspace's
 * add-ons. `occurredAt` orders events: an older one than the stored state is ignored.
 */
export const subscriptionChangeSchema = z.object({
  workspaceId: id,
  planId: catalogId,
  status: z.enum(SUBSCRIPTION_STATUSES),
  periodStart: z.date().nullable(),
  periodEnd: z.date().nullable(),
  trialEndsAt: z.date().nullable(),
  provider: z.string().min(1).max(50),
  customerId: id.nullable(),
  subscriptionId: id.nullable(),
  addons: uniqueAddons.optional(),
  occurredAt: z.date(),
});
export type SubscriptionChangeInput = z.infer<typeof subscriptionChangeSchema>;

/** Admin: put a workspace on a plan (manual billing, or an exception in provider mode). */
export const assignPlanInputSchema = z
  .object({
    workspaceId: id,
    planId: catalogId,
    status: z.enum(["trialing", "active"]).default("active"),
    /** ISO 8601; required with status trialing. */
    trialEndsAt: z.iso.datetime().nullable().default(null),
    /** ISO 8601; when the paid period ends, if the admin tracks one. */
    periodEnd: z.iso.datetime().nullable().default(null),
  })
  .refine((input) => input.status !== "trialing" || input.trialEndsAt, {
    message: "trialEndsAt is required with status trialing",
    path: ["trialEndsAt"],
  });
export type AssignPlanInput = z.input<typeof assignPlanInputSchema>;

/** Admin: replace a workspace's add-ons (an empty list removes them all). */
export const setAddonsInputSchema = z.object({
  workspaceId: id,
  addons: uniqueAddons,
});
export type SetAddonsInput = z.input<typeof setAddonsInputSchema>;

/** Admin: grant or revoke a feature, or set a limit, for one workspace; null removes it. */
export const setOverrideInputSchema = z.object({
  workspaceId: id,
  key: catalogId,
  override: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("feature"), enabled: z.boolean() }),
      z.object({
        kind: z.literal("limit"),
        /** null is unlimited. */
        limit: z.number().int().min(0).nullable(),
      }),
    ])
    .nullable(),
  reason: z.string().trim().min(3).max(200),
});
export type SetOverrideInput = z.input<typeof setOverrideInputSchema>;
