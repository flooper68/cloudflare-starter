import { describeBillingProviderContract } from "../../ports/billing-provider.contract";
import { createMemoryBillingProvider } from "./memory-billing-provider";

describeBillingProviderContract("createMemoryBillingProvider", () => {
  const provider = createMemoryBillingProvider({ secret: "s3cret-for-tests" });
  return {
    provider,
    sells: true,
    signedWebhook: (change) => provider.webhookRequest(change),
    forgedWebhook: () =>
      provider.webhookRequest(
        {
          workspaceId: "ws-acme",
          planId: "pro",
          status: "active",
          periodStart: null,
          periodEnd: null,
          trialEndsAt: null,
          provider: "memory",
          customerId: null,
          subscriptionId: null,
          occurredAt: new Date("2026-10-28T12:00:00.000Z"),
        },
        { secret: "guessed" }
      ),
    ignoredWebhook: () =>
      provider.webhookRequest(
        {
          workspaceId: "ws-acme",
          planId: "pro",
          status: "active",
          periodStart: null,
          periodEnd: null,
          trialEndsAt: null,
          provider: "memory",
          customerId: null,
          subscriptionId: null,
          occurredAt: new Date("2026-10-28T12:00:00.000Z"),
        },
        { type: "invoice.created" }
      ),
  };
});
