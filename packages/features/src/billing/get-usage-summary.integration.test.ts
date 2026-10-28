import { describe, expect, it } from "vitest";

import { billingDeps, seedUser, seedWorkspace } from "../../test/fixtures";
import { getUsageSummary } from "./get-usage-summary";
import { recordUsage } from "./record-usage";

describe("getUsageSummary", () => {
  it("lists every metric's use against the plan's limit", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-summary" });
    await recordUsage(
      billingDeps(),
      actor.workspaceId,
      "files.uploads_per_month",
      7
    );
    expect(await getUsageSummary(billingDeps(), actor.workspaceId)).toEqual({
      planId: "free",
      period: "2026-10",
      metrics: [
        {
          metric: "storage_bytes",
          kind: "current",
          unit: "bytes",
          used: 0,
          limit: 100 * 1024 * 1024,
        },
        {
          metric: "files.uploads_per_month",
          kind: "period",
          unit: "count",
          used: 7,
          limit: 100,
        },
        { metric: "seats", kind: "current", unit: "count", used: 1, limit: 3 },
      ],
    });
  });

  it("shows no limits with billing off", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-summary-off" });
    const summary = await getUsageSummary(
      billingDeps("off"),
      actor.workspaceId
    );
    expect(summary.planId).toBe("unlimited");
    expect(summary.metrics.every((line) => line.limit === null)).toBe(true);
  });
});
