import { describe, expect, it } from "vitest";

import {
  addMember,
  billingDeps,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { getBillingSummary } from "./get-billing-summary";
import { startTrial } from "./start-trial";

describe("getBillingSummary", () => {
  it("shows members the plan, trial, features and usage", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-billing" });
    const member = await addMember(actor.workspaceId, colleague.id);
    await startTrial(billingDeps(), actor.workspaceId);

    const summary = await getBillingSummary(billingDeps(), member);
    expect(summary).toMatchObject({
      mode: "manual",
      planId: "pro",
      planName: "Pro",
      status: "trialing",
      trialEndsAt: "2026-11-11T12:00:00.000Z",
      features: ["files.presigned_upload"],
      addons: [],
      usage: { planId: "pro", period: "2026-10" },
    });
    expect(summary.usage.metrics.find((m) => m.metric === "seats")).toEqual({
      metric: "seats",
      kind: "current",
      unit: "count",
      used: 2,
      limit: 25,
    });
  });
});
