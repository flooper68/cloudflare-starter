import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingProvider } from "../platform";
import { type Actor, requirePermission } from "../workspaces";
import { workspaceSubscription } from "./billing.schema";
import {
  type BillingSettings,
  BillingUnavailableError,
  NoProviderCustomerError,
} from "./domain";

/**
 * The provider's customer portal (invoices, payment method, cancel) for an owner
 * (`billing.manage`). Only with BILLING=provider and once the workspace has a provider
 * customer (after its first checkout).
 */
export async function createPortalUrl(
  deps: {
    readonly db: Database;
    readonly settings: BillingSettings;
    readonly provider: BillingProvider;
    readonly appUrl: string;
  },
  actor: Actor
): Promise<{ readonly url: string }> {
  requirePermission(actor, "billing.manage");
  if (deps.settings.mode !== "provider")
    throw new BillingUnavailableError(
      "The billing portal needs BILLING=provider; ask an admin about invoices"
    );
  const [subscription] = await deps.db
    .select({ customerId: workspaceSubscription.providerCustomerId })
    .from(workspaceSubscription)
    .where(eq(workspaceSubscription.workspaceId, actor.workspaceId));
  if (!subscription?.customerId) throw new NoProviderCustomerError();
  return deps.provider.portalUrl({
    workspaceId: actor.workspaceId,
    customerId: subscription.customerId,
    returnUrl: `${deps.appUrl.replace(/\/+$/, "")}/app`,
  });
}
