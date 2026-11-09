import { describe, expect, it } from "vitest";

import { rows, seedUser, useCaseDeps } from "../../test/fixtures";
import { createMemoryLogger, noopProductAnalytics } from "../platform";
import { reachMilestoneOnce } from "./reach-milestone";

describe("reachMilestoneOnce", () => {
  it("is true the first time only and keeps one row per person and milestone", async () => {
    const ada = await seedUser("Ada Milestone");
    const deps = useCaseDeps();
    expect(await reachMilestoneOnce(deps, ada.id, "notes")).toBe(true);
    expect(await reachMilestoneOnce(deps, ada.id, "notes")).toBe(false);
    // Another isolate (no cache) sees the row: still once.
    expect(
      await reachMilestoneOnce(
        { ...deps, clock: { now: () => new Date() } },
        ada.id,
        "notes"
      )
    ).toBe(false);
    expect(await reachMilestoneOnce(deps, ada.id, "files")).toBe(true);
    expect(
      await rows(
        "SELECT milestone, reached_at FROM analytics_milestones WHERE user_id = ? ORDER BY milestone",
        ada.id
      )
    ).toEqual([
      {
        milestone: "files",
        reached_at: Date.parse("2026-10-28T12:00:00.000Z"),
      },
      {
        milestone: "notes",
        reached_at: Date.parse("2026-10-28T12:00:00.000Z"),
      },
    ]);
  });

  it("writes nothing while analytics are off or the person is left out", async () => {
    const grace = await seedUser("Grace Milestone");
    const deps = { ...useCaseDeps(), analytics: noopProductAnalytics };
    expect(await reachMilestoneOnce(deps, grace.id, "notes")).toBe(false);
    expect(
      await rows(
        "SELECT milestone FROM analytics_milestones WHERE user_id = ?",
        grace.id
      )
    ).toEqual([]);
  });

  it("logs a failed write and answers false instead of throwing", async () => {
    const logger = createMemoryLogger();
    // No such user: the foreign key refuses the row.
    expect(
      await reachMilestoneOnce(
        { ...useCaseDeps(), logger },
        "no-such-user",
        "notes"
      )
    ).toBe(false);
    expect(logger.records.map((record) => record.body)).toContain(
      "product_analytics.milestone_failed"
    );
  });

  it("goes with the account", async () => {
    const linus = await seedUser("Linus Milestone");
    await reachMilestoneOnce(useCaseDeps(), linus.id, "notes");
    await rows("DELETE FROM user WHERE id = ?", linus.id);
    expect(
      await rows(
        "SELECT milestone FROM analytics_milestones WHERE user_id = ?",
        linus.id
      )
    ).toEqual([]);
  });
});
