/**
 * The BillingProvider contract: every adapter's `*.contract.test.ts` runs this suite against
 * it. Test support only (not exported from the barrel, not bundled).
 */
import { describe, expect, it } from "vitest";

import { DomainError } from "../../kernel";
import type { BillingProvider, SubscriptionChange } from "./billing-provider";

export interface BillingProviderHarness {
  readonly provider: BillingProvider;
  /** false for adapters that cannot sell (noop): checkout and portal throw `unavailable`. */
  readonly sells: boolean;
  /** An authentic webhook carrying `change`; omit for adapters that receive none (noop). */
  readonly signedWebhook?: (change: SubscriptionChange) => Request;
  /** A webhook whose authenticity check fails. */
  readonly forgedWebhook?: () => Request;
  /** An authentic webhook for an event the app does not act on. */
  readonly ignoredWebhook?: () => Request;
}

const CHANGE: SubscriptionChange = {
  workspaceId: "ws-acme",
  planId: "pro",
  status: "active",
  periodStart: new Date("2026-10-01T00:00:00.000Z"),
  periodEnd: new Date("2026-11-01T00:00:00.000Z"),
  trialEndsAt: null,
  provider: "contract",
  customerId: "cus_123",
  subscriptionId: "sub_456",
  addons: [{ addonId: "extra_seats", quantity: 2 }],
  occurredAt: new Date("2026-10-28T12:00:00.000Z"),
};

const checkout = {
  workspaceId: "ws-acme",
  planId: "pro",
  addons: [],
  customerEmail: "nicole@example.test",
  customerId: null,
  successUrl: "https://app.example.test/app?billing=success",
  cancelUrl: "https://app.example.test/app?billing=canceled",
};

const portal = {
  workspaceId: "ws-acme",
  customerId: "cus_123",
  returnUrl: "https://app.example.test/app",
};

async function rejectsWith(promise: Promise<unknown>, kind: string) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).kind).toBe(kind);
}

export function describeBillingProviderContract(
  name: string,
  makeHarness: () => BillingProviderHarness
): void {
  describe(`${name} satisfies the BillingProvider contract`, () => {
    it("has a name to store on subscriptions", () => {
      expect(makeHarness().provider.name).toMatch(/^[a-z][a-z0-9_-]*$/);
    });

    const probe = makeHarness();

    if (probe.sells) {
      it("returns absolute URLs for checkout and the portal", async () => {
        const { provider } = makeHarness();
        const opened = await provider.createCheckout(checkout);
        expect(new URL(opened.url).protocol).toMatch(/^https?:$/);
        const managed = await provider.portalUrl(portal);
        expect(new URL(managed.url).protocol).toMatch(/^https?:$/);
      });
    } else {
      it("refuses checkout and the portal as unavailable", async () => {
        const { provider } = makeHarness();
        await rejectsWith(provider.createCheckout(checkout), "unavailable");
        await rejectsWith(provider.portalUrl(portal), "unavailable");
      });
    }

    const { signedWebhook, forgedWebhook, ignoredWebhook } = probe;
    if (signedWebhook && forgedWebhook && ignoredWebhook) {
      it("normalizes an authentic subscription event", async () => {
        const { provider } = makeHarness();
        expect(await provider.parseWebhook(signedWebhook(CHANGE))).toEqual(
          CHANGE
        );
      });

      it("rejects a forged event as invalid input", async () => {
        const { provider } = makeHarness();
        await rejectsWith(
          provider.parseWebhook(forgedWebhook()),
          "invalid_input"
        );
      });

      it("returns null for an event the app does not act on", async () => {
        const { provider } = makeHarness();
        expect(await provider.parseWebhook(ignoredWebhook())).toBeNull();
      });
    } else {
      it("acts on no webhook", async () => {
        const { provider } = makeHarness();
        const request = new Request(
          "https://app.example.test/api/billing/webhook",
          {
            method: "POST",
            body: JSON.stringify({ type: "customer.subscription.updated" }),
          }
        );
        expect(await provider.parseWebhook(request)).toBeNull();
      });
    }
  });
}
