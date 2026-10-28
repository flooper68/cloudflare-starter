import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingProvider } from "../platform";
import { type Actor, requirePermission } from "../workspaces";
import { workspaceSubscription } from "./billing.schema";
import {
  type AddonGrant,
  type BillingSettings,
  BillingUnavailableError,
  findAddon,
  findPlan,
  UnknownCatalogKeyError,
} from "./domain";

/**
 * A provider checkout page where an owner (`billing.manage`) buys a plan and add-ons for
 * their workspace. Only with BILLING=provider; the result arrives later through the
 * webhook (applySubscriptionChange). Internal plans are not sold.
 */
export async function createCheckoutUrl(
  deps: {
    readonly db: Database;
    readonly settings: BillingSettings;
    readonly provider: BillingProvider;
    /** The app's origin, for the return URLs. */
    readonly appUrl: string;
  },
  actor: Actor,
  input: {
    readonly planId: string;
    readonly addons: readonly AddonGrant[];
    readonly customerEmail: string;
  }
): Promise<{ readonly url: string }> {
  requirePermission(actor, "billing.manage");
  if (deps.settings.mode !== "provider")
    throw new BillingUnavailableError(
      "Online checkout needs BILLING=provider; ask an admin to change the plan"
    );
  const plan = findPlan(input.planId);
  if (!plan || plan.internal)
    throw new UnknownCatalogKeyError("plan", input.planId);
  for (const addon of input.addons) {
    if (!findAddon(addon.addonId))
      throw new UnknownCatalogKeyError("addon", addon.addonId);
  }

  const [subscription] = await deps.db
    .select({ customerId: workspaceSubscription.providerCustomerId })
    .from(workspaceSubscription)
    .where(eq(workspaceSubscription.workspaceId, actor.workspaceId));
  const base = deps.appUrl.replace(/\/+$/, "");
  return deps.provider.createCheckout({
    workspaceId: actor.workspaceId,
    planId: plan.id,
    addons: input.addons,
    customerEmail: input.customerEmail,
    customerId: subscription?.customerId ?? null,
    successUrl: `${base}/app?billing=success`,
    cancelUrl: `${base}/app?billing=canceled`,
  });
}
