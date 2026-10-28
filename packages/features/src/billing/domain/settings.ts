import { z } from "zod";

/**
 * How billing runs in an environment (`BILLING`, required, no default):
 * - off: every workspace gets everything without limits; no trials, no counters;
 * - manual: plans, add-ons and overrides are set by an admin; no checkout;
 * - provider: a project-written BillingProvider adapter sells plans and reports changes
 *   through the webhook (docs/guides/how-to-configure-plans-and-billing.md).
 */
export const BILLING_MODES = ["off", "manual", "provider"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export interface BillingSettings {
  readonly mode: BillingMode;
}

/** Parses the `BILLING` var; written per environment by setup:auth. */
export const billingSettingsSchema = z
  .object({
    BILLING: z.enum(BILLING_MODES, {
      error: "BILLING must be off, manual or provider",
    }),
  })
  .transform((raw): BillingSettings => ({ mode: raw.BILLING }));
