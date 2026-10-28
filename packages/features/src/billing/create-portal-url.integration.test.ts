import { describe, expect, it } from "vitest";

import {
  addMember,
  billingDeps,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { createMemoryBillingProvider } from "../platform";
import { ActionNotAllowedError } from "../workspaces";
import { applySubscriptionChange } from "./apply-subscription-change";
import { createPortalUrl } from "./create-portal-url";
import { BillingUnavailableError, NoProviderCustomerError } from "./domain";

describe("createPortalUrl", () => {
  it("needs provider mode and a provider customer", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-portal" });
    const provider = createMemoryBillingProvider();
    const deps = (mode: "manual" | "provider") => ({
      db: testDb(),
      settings: { mode },
      provider,
      appUrl: "https://app.example.test",
    });

    await expect(createPortalUrl(deps("manual"), actor)).rejects.toBeInstanceOf(
      BillingUnavailableError
    );
    await expect(
      createPortalUrl(deps("provider"), actor)
    ).rejects.toBeInstanceOf(NoProviderCustomerError);

    await applySubscriptionChange(billingDeps("provider"), {
      workspaceId: actor.workspaceId,
      planId: "pro",
      status: "active",
      periodStart: null,
      periodEnd: null,
      trialEndsAt: null,
      provider: "memory",
      customerId: "cus_portal",
      subscriptionId: "sub_portal",
      occurredAt: new Date("2026-10-28T12:00:00.000Z"),
    });
    expect(await createPortalUrl(deps("provider"), actor)).toEqual({
      url: "https://billing.example.test/portal/cus_portal",
    });
    expect(provider.portals).toEqual([
      {
        workspaceId: actor.workspaceId,
        customerId: "cus_portal",
        returnUrl: "https://app.example.test/app",
      },
    ]);

    // Members may read the plan but not manage billing.
    const colleague = await seedUser("Grace Hopper");
    const member = await addMember(actor.workspaceId, colleague.id);
    await expect(
      createPortalUrl(deps("provider"), member)
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
  });
});
