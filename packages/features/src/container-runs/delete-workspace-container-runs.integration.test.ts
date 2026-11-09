import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { deleteWorkspaceContainerRuns } from "./delete-workspace-container-runs";
import { storeContainerRunResult } from "./store-container-run-result";

describe("deleteWorkspaceContainerRuns", () => {
  it("deletes the runs and R2 results of the given workspaces only", async () => {
    const ada = await seedUser("Ada Erase Runs");
    const bob = await seedUser("Bob Erase Runs");
    const gone = await seedWorkspace(ada.id, { id: "ws-cr-erase" });
    const kept = await seedWorkspace(bob.id, { id: "ws-cr-keep" });
    const goneRun = await startRun(gone);
    const keptRun = await startRun(kept);
    for (const runId of [goneRun, keptRun]) {
      await storeContainerRunResult(containerDeps(), {
        runId,
        pi: "3.14",
        computeMs: 1,
      });
    }

    expect(
      await deleteWorkspaceContainerRuns(containerDeps(), {
        workspaceIds: ["ws-cr-erase"],
      })
    ).toEqual({ deleted: 1 });
    expect(
      await env.FILES.head(
        `workspaces/ws-cr-erase/container-runs/${goneRun}.txt`
      )
    ).toBeNull();
    expect(
      await env.FILES.head(
        `workspaces/ws-cr-keep/container-runs/${keptRun}.txt`
      )
    ).not.toBeNull();
    expect(
      await rows(
        "SELECT id FROM container_runs WHERE id IN (?, ?)",
        goneRun,
        keptRun
      )
    ).toEqual([{ id: keptRun }]);
    expect(
      await deleteWorkspaceContainerRuns(containerDeps(), { workspaceIds: [] })
    ).toEqual({ deleted: 0 });
  });
});
