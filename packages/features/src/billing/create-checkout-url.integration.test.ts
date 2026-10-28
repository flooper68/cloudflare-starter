import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { createMemoryBillingProvider } from "../platform";
import { ActionNotAllowedError } from "../workspaces";
import { createCheckoutUrl } from "./create-checkout-url";
import { BillingUnavailableError, UnknownCatalogKeyError } from "./domain";

const deps = (
  mode: "manual" | "provider",
  provider = createMemoryBillingProvider()
) => ({
  db: testDb(),
  settings: { mode },
  provider,
  appUrl: "https://app.example.test/",
});

describe("createCheckoutUrl", () => {
  it("opens the provider's checkout for an owner in provider mode", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-checkout" });
    const provider = createMemoryBillingProvider();
    expect(
      await createCheckoutUrl(deps("provider", provider), actor, {
        planId: "pro",
        addons: [{ addonId: "extra_seats", quantity: 1 }],
        customerEmail: owner.email,
      })
    ).toEqual({ url: "https://billing.example.test/checkout/ws-checkout/pro" });
    expect(provider.checkouts).toEqual([
      {
        workspaceId: "ws-checkout",
        planId: "pro",
        addons: [{ addonId: "extra_seats", quantity: 1 }],
        customerEmail: owner.email,
        customerId: null,
        successUrl: "https://app.example.test/app?billing=success",
        cancelUrl: "https://app.example.test/app?billing=canceled",
      },
    ]);
  });

  it("refuses members, other modes and plans that are not for sale", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-checkout-no" });
    const member = await addMember(actor.workspaceId, colleague.id);
    const input = { planId: "pro", addons: [], customerEmail: owner.email };
    await expect(
      createCheckoutUrl(deps("provider"), member, input)
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
    await expect(
      createCheckoutUrl(deps("manual"), actor, input)
    ).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(
      createCheckoutUrl(deps("provider"), actor, {
        ...input,
        planId: "unlimited",
      })
    ).rejects.toBeInstanceOf(UnknownCatalogKeyError);
  });
});
