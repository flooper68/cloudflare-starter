import { describe, expect, it } from "vitest";

import { billingDeps, seedUser, seedWorkspace } from "../../test/fixtures";
import { assignPlan } from "./assign-plan";
import { resolveEntitlements } from "./resolve-entitlements";
import { setAddons } from "./set-addons";
import { setOverride } from "./set-override";
import { startTrial } from "./start-trial";

describe("resolveEntitlements", () => {
  it("is unlimited without a query when billing is off", async () => {
    const resolved = await resolveEntitlements(
      billingDeps("off"),
      "ws-does-not-matter"
    );
    expect(resolved).toMatchObject({
      mode: "off",
      planId: "unlimited",
      status: null,
      entitlements: {
        features: ["files.presigned_upload"],
        limits: {
          storage_bytes: null,
          "files.uploads_per_month": null,
          seats: null,
        },
      },
    });
  });

  it("puts a workspace without a subscription on the default plan", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-default" });
    const resolved = await resolveEntitlements(
      billingDeps(),
      actor.workspaceId
    );
    expect(resolved).toMatchObject({
      planId: "free",
      status: null,
      entitlements: { features: [], limits: { seats: 3 } },
    });
  });

  it("follows the subscription's lifecycle: trial, then its fallback once it ended", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-trial" });
    await startTrial(billingDeps("manual"), actor.workspaceId);

    const during = await resolveEntitlements(billingDeps(), actor.workspaceId);
    expect(during).toMatchObject({ planId: "pro", status: "trialing" });
    expect(during.trialEndsAt?.toISOString()).toBe("2026-11-11T12:00:00.000Z");

    // Before the daily cron writes it, an ended trial already counts as the fallback.
    const after = await resolveEntitlements(
      billingDeps("manual", "2026-11-11T12:00:00.000Z"),
      actor.workspaceId
    );
    expect(after).toMatchObject({ planId: "free", status: "active" });
  });

  it("lets overrides win over the plan and its add-ons", async () => {
    const owner = await seedUser("Grace Hopper");
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-override" });
    const deps = billingDeps();
    await assignPlan(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        planId: "pro",
      }
    );
    await setAddons(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        addons: [{ addonId: "extra_seats", quantity: 2 }],
      }
    );
    expect(
      (await resolveEntitlements(deps, actor.workspaceId)).entitlements.limits
        .seats
    ).toBe(35);

    await setOverride(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "seats",
        override: { kind: "limit", limit: 4 },
        reason: "Pilot with a fixed team",
      }
    );
    await setOverride(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "files.presigned_upload",
        override: { kind: "feature", enabled: false },
        reason: "Direct uploads paused for this customer",
      }
    );
    const resolved = await resolveEntitlements(deps, actor.workspaceId);
    expect(resolved.entitlements).toMatchObject({
      planId: "pro",
      features: [],
      limits: { seats: 4 },
    });
    expect(resolved.overrides).toEqual([
      { key: "files.presigned_upload", kind: "feature", enabled: false },
      { key: "seats", kind: "limit", limit: 4 },
    ]);
  });
});
