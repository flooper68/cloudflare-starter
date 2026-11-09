import { describe, expect, it } from "vitest";

import { advanceRun, startRun } from "../../test/container-run-fixtures";
import { seedUser, seedWorkspace, testDb } from "../../test/fixtures";
import { getContainerRun } from "./get-container-run";

describe("getContainerRun", () => {
  it("reads a run of the actor's workspace with its timeline and starter", async () => {
    const ada = await seedUser("Ada Get");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-get" });
    const runId = await startRun(actor, 1000);
    await advanceRun(runId, ["starting", "computing"]);

    const run = await getContainerRun({ db: testDb() }, actor, { runId });
    expect(run).toMatchObject({
      id: runId,
      digits: 1000,
      status: "running",
      startedBy: { id: ada.id, name: "Ada Get" },
      result: null,
      durationMs: null,
    });
    expect(run.steps.map((step) => step.status)).toEqual([
      "done",
      "done",
      "running",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("is not found in another workspace", async () => {
    const ada = await seedUser("Ada Get Other");
    const bob = await seedUser("Bob Get Other");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-get-a" });
    const other = await seedWorkspace(bob.id, { id: "ws-cr-get-b" });
    const runId = await startRun(actor);
    await expect(
      getContainerRun({ db: testDb() }, other, { runId })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
