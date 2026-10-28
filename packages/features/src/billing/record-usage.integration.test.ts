import { describe, expect, it } from "vitest";

import {
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { recordUsage } from "./record-usage";

describe("recordUsage", () => {
  it("adds to this month's counter and starts a new one each month", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-usage" });
    const metric = "files.uploads_per_month";
    await recordUsage(billingDeps(), actor.workspaceId, metric, 1);
    await recordUsage(billingDeps(), actor.workspaceId, metric, 2);
    await recordUsage(
      billingDeps("manual", "2026-11-01T00:00:00.000Z"),
      actor.workspaceId,
      metric,
      1
    );
    expect(
      await rows(
        "SELECT metric, period, value FROM usage_counter WHERE workspace_id = ? ORDER BY period",
        actor.workspaceId
      )
    ).toEqual([
      { metric, period: "2026-10", value: 3 },
      { metric, period: "2026-11", value: 1 },
    ]);
  });

  it("counts nothing with billing off and refuses a metric that is not a counter", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-off" });
    await recordUsage(
      billingDeps("off"),
      actor.workspaceId,
      "files.uploads_per_month",
      1
    );
    expect(
      await rows(
        "SELECT * FROM usage_counter WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([]);
    await expect(
      recordUsage(billingDeps(), actor.workspaceId, "seats", 1)
    ).rejects.toThrow(/not a period metric/);
  });
});
