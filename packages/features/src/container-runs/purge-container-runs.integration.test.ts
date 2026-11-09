import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { purgeContainerRuns } from "./purge-container-runs";
import { storeContainerRunResult } from "./store-container-run-result";

describe("purgeContainerRuns", () => {
  it("deletes runs 7 days after they started, with their results; younger runs stay", async () => {
    const ada = await seedUser("Ada Purge");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-purge" });
    const old = await startRun(actor, 1000, "2026-10-20T12:00:00.000Z");
    const young = await startRun(actor, 1000, "2026-10-26T12:00:00.000Z");
    for (const runId of [old, young]) {
      await storeContainerRunResult(containerDeps(), {
        runId,
        pi: "3.14",
        computeMs: 1,
      });
    }

    const purged = await purgeContainerRuns(containerDeps(), {
      asOf: "2026-10-27T12:00:00.000Z",
    });
    expect(purged).toEqual({ deleted: 1 });
    expect(
      await rows(
        "SELECT id FROM container_runs WHERE workspace_id = ?",
        "ws-cr-purge"
      )
    ).toEqual([{ id: young }]);
    expect(
      await env.FILES.head(`workspaces/ws-cr-purge/container-runs/${old}.txt`)
    ).toBeNull();
    expect(
      await env.FILES.head(`workspaces/ws-cr-purge/container-runs/${young}.txt`)
    ).not.toBeNull();
    expect(
      await purgeContainerRuns(containerDeps(), {
        asOf: "2026-10-27T12:00:00.000Z",
      })
    ).toEqual({ deleted: 0 });
    // Hourly counters older than a day go too; today's stay.
    expect(
      await rows(
        "SELECT hour FROM container_run_user_quota WHERE user_id = ? ORDER BY hour",
        ada.id
      )
    ).toEqual([{ hour: "2026-10-26T12" }]);
  });
});
