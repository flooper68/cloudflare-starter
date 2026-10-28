/**
 * Port: the payment provider that sells plans (Stripe, Paddle, Lemon Squeezy, …). The
 * starter ships no vendor adapter: `noop` (BILLING=off and manual) and `memory` (tests).
 * A project writes one in platform/adapters/<vendor>/ and registers it in
 * apps/web/src/server/billing-provider.ts (docs/guides/how-to-configure-plans-and-billing.md).
 * Implementations pass `describeBillingProviderContract` (billing-provider.contract.ts).
 *
 * Failures the caller should explain are DomainErrors from the kernel: `unavailable` when
 * the adapter cannot sell (noop), `invalid_input` for a webhook whose signature fails.
 */
export interface BillingProvider {
  /** The adapter's name, stored as the subscription's `provider` ("stripe"). */
  readonly name: string;
  /** A hosted checkout page for the workspace to buy `planId` (and add-ons). */
  createCheckout(input: CheckoutInput): Promise<{ readonly url: string }>;
  /** The provider's customer portal (invoices, payment method, cancel). */
  portalUrl(input: PortalInput): Promise<{ readonly url: string }>;
  /**
   * Verifies a webhook request and normalizes it: a SubscriptionChange, or null for an
   * event the app does not act on. Throws an `invalid_input` DomainError when the request
   * is not authentic. Reads the body once.
   */
  parseWebhook(request: Request): Promise<SubscriptionChange | null>;
}

export interface CheckoutInput {
  readonly workspaceId: string;
  readonly planId: string;
  readonly addons: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
  /** The buyer's email, to prefill the checkout. */
  readonly customerEmail: string;
  /** The provider's customer id when the workspace already has one. */
  readonly customerId: string | null;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface PortalInput {
  readonly workspaceId: string;
  readonly customerId: string;
  readonly returnUrl: string;
}

/** A provider's subscription event in the app's terms (catalog plan and add-on ids). */
export interface SubscriptionChange {
  readonly workspaceId: string;
  readonly planId: string;
  readonly status: "trialing" | "active" | "past_due" | "canceled";
  readonly periodStart: Date | null;
  readonly periodEnd: Date | null;
  readonly trialEndsAt: Date | null;
  readonly provider: string;
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
  /** When given, replaces the workspace's add-ons. */
  readonly addons?: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
  /** When the provider says the change happened; older events than the stored state are ignored. */
  readonly occurredAt: Date;
}
