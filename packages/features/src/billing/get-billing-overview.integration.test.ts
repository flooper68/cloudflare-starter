import { describe, expect, it } from "vitest";

import { billingDeps, seedUser, seedWorkspace } from "../../test/fixtures";
import { DEFAULT_PLAN_ID, NEW_WORKSPACE_PLAN_ID } from "./domain";
import { getBillingOverview } from "./get-billing-overview";
import { recordUsage } from "./record-usage";
import { startTrial } from "./start-trial";

const NOW = "2026-10-28T12:00:00.000Z";
const TEN_DAYS_AGO = "2026-10-18T12:00:00.000Z";

describe("getBillingOverview", () => {
  it("counts workspaces per plan and status, trials ending soon, and this period's counters", async () => {
    const owner = await seedUser("Olga Overview");
    const a = await seedWorkspace(owner.id, { id: "ws-trial-old" });
    const b = await seedWorkspace(owner.id, { id: "ws-trial-new" });
    await seedWorkspace(owner.id, { id: "ws-no-subscription" });
    // A 14-day trial started ten days ago ends within the week; one started now does not.
    await startTrial(billingDeps("manual", TEN_DAYS_AGO), a.workspaceId);
    await startTrial(billingDeps("manual", NOW), b.workspaceId);
    await recordUsage(
      billingDeps("manual", NOW),
      a.workspaceId,
      "files.uploads_per_month",
      3
    );
    await recordUsage(
      billingDeps("manual", NOW),
      b.workspaceId,
      "files.uploads_per_month",
      2
    );

    const overview = await getBillingOverview(billingDeps("manual", NOW));
    expect(overview?.plans).toEqual([
      expect.objectContaining({
        planId: NEW_WORKSPACE_PLAN_ID,
        status: "trialing",
        workspaces: 2,
      }),
      expect.objectContaining({
        planId: DEFAULT_PLAN_ID,
        status: null,
        workspaces: 1,
      }),
    ]);
    expect(overview?.trials).toEqual({ active: 2, endingSoon: 1 });
    expect(overview?.usage).toEqual({
      period: "2026-10",
      metrics: [{ metric: "files.uploads_per_month", unit: "count", total: 5 }],
    });
  });

  it("is null with BILLING=off", async () => {
    expect(await getBillingOverview(billingDeps("off", NOW))).toBeNull();
  });
});
