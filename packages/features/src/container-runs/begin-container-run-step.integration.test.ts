import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { beginContainerRunStep } from "./begin-container-run-step";

describe("beginContainerRunStep", () => {
  it("records the step in the timeline, marks the run running and returns what the step needs", async () => {
    const ada = await seedUser("Ada Begin");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-begin" });
    const runId = await startRun(actor, 50_000);

    const run = await beginContainerRunStep(
      containerDeps({ at: "2026-10-28T12:00:02.000Z" }),
      { runId, step: "starting" }
    );
    expect(run).toEqual({
      workspaceId: "ws-cr-begin",
      digits: 50_000,
      createdBy: ada.id,
    });
    const [row] = await rows(
      "SELECT status, steps FROM container_runs WHERE id = ?",
      runId
    );
    expect(row?.status).toBe("running");
    expect(JSON.parse(String(row?.steps)).slice(0, 2)).toEqual([
      {
        name: "queued",
        status: "done",
        startedAt: "2026-10-28T12:00:00.000Z",
        finishedAt: "2026-10-28T12:00:02.000Z",
      },
      {
        name: "starting",
        status: "running",
        startedAt: "2026-10-28T12:00:02.000Z",
        finishedAt: null,
      },
    ]);
  });

  it("changes nothing when a retried step begins again", async () => {
    const ada = await seedUser("Ada Begin Again");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-begin-again" });
    const runId = await startRun(actor);
    await beginContainerRunStep(
      containerDeps({ at: "2026-10-28T12:00:01.000Z" }),
      {
        runId,
        step: "starting",
      }
    );
    const before = await rows(
      "SELECT steps FROM container_runs WHERE id = ?",
      runId
    );
    await beginContainerRunStep(
      containerDeps({ at: "2026-10-28T12:00:09.000Z" }),
      {
        runId,
        step: "starting",
      }
    );
    expect(
      await rows("SELECT steps FROM container_runs WHERE id = ?", runId)
    ).toEqual(before);
  });

  it("refuses a step out of order, and a run that is gone", async () => {
    const ada = await seedUser("Ada Begin Order");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-begin-order" });
    const runId = await startRun(actor);
    await expect(
      beginContainerRunStep(containerDeps(), { runId, step: "storing" })
    ).rejects.toThrow(/cannot start storing/);
    await expect(
      beginContainerRunStep(containerDeps(), {
        runId: "00000000-0000-4000-8000-00000000dead",
        step: "starting",
      })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
