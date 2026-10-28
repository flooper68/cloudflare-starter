import { DomainError } from "../../../kernel";
import type {
  BillingProvider,
  CheckoutInput,
  PortalInput,
  SubscriptionChange,
} from "../../ports";

/** The header the memory provider "signs" its webhooks with. */
const SIGNATURE_HEADER = "x-memory-signature";
const CHANGED = "subscription.changed";

export interface MemoryBillingProvider extends BillingProvider {
  readonly checkouts: CheckoutInput[];
  readonly portals: PortalInput[];
  /** A webhook request as the "provider" would send it; a wrong secret makes it forged. */
  webhookRequest(
    change: SubscriptionChange,
    options?: { readonly secret?: string; readonly type?: string }
  ): Request;
}

const DATES = [
  "periodStart",
  "periodEnd",
  "trialEndsAt",
  "occurredAt",
] as const;

/**
 * BillingProvider for tests: records checkouts and portal visits, returns example URLs, and
 * accepts webhooks carrying a SubscriptionChange as JSON, authenticated by a shared secret
 * in a header (a stand-in for a provider's signature).
 */
export function createMemoryBillingProvider(
  options: { readonly secret?: string; readonly name?: string } = {}
): MemoryBillingProvider {
  const secret = options.secret ?? "memory-webhook-secret";
  const checkouts: CheckoutInput[] = [];
  const portals: PortalInput[] = [];

  return {
    name: options.name ?? "memory",
    checkouts,
    portals,
    createCheckout: async (input) => {
      checkouts.push(input);
      return {
        url: `https://billing.example.test/checkout/${encodeURIComponent(input.workspaceId)}/${encodeURIComponent(input.planId)}`,
      };
    },
    portalUrl: async (input) => {
      portals.push(input);
      return {
        url: `https://billing.example.test/portal/${encodeURIComponent(input.customerId)}`,
      };
    },
    parseWebhook: async (request) => {
      if (request.headers.get(SIGNATURE_HEADER) !== secret) {
        throw new DomainError("invalid_input", "Invalid webhook signature");
      }
      const body = (await request.json()) as {
        type?: string;
        change?: Record<string, unknown>;
      };
      if (body.type !== CHANGED || !body.change) return null;
      const change = { ...body.change };
      for (const key of DATES) {
        const value = change[key];
        change[key] = typeof value === "string" ? new Date(value) : null;
      }
      return change as unknown as SubscriptionChange;
    },
    webhookRequest: (change, request = {}) =>
      new Request("https://app.example.test/api/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [SIGNATURE_HEADER]: request.secret ?? secret,
        },
        body: JSON.stringify({ type: request.type ?? CHANGED, change }),
      }),
  };
}
