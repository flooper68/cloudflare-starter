import { describe, expect, it } from "vitest";

import {
  advanceRun,
  containerDeps,
  startRun,
} from "../../test/container-run-fixtures";
import { auditTrail, rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { finishContainerRun } from "./finish-container-run";

describe("finishContainerRun", () => {
  it("finishes a run that went through every step, audited as the system", async () => {
    const ada = await seedUser("Ada Finish");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-finish" });
    const runId = await startRun(actor, 1000);
    await advanceRun(runId, ["starting", "computing", "storing", "notifying"]);

    const done = await finishContainerRun(
      containerDeps({ at: "2026-10-28T12:00:07.000Z" }),
      { runId, outcome: "succeeded" }
    );
    expect(done).toEqual({ changed: true });
    const [row] = await rows(
      "SELECT status, error_code, finished_at, steps FROM container_runs WHERE id = ?",
      runId
    );
    expect(row).toMatchObject({
      status: "succeeded",
      error_code: null,
      finished_at: Date.parse("2026-10-28T12:00:07.000Z"),
    });
    expect(
      JSON.parse(String(row?.steps)).map((s: { status: string }) => s.status)
    ).toEqual(["done", "done", "done", "done", "done", "done"]);
    expect((await auditTrail("ws-cr-finish")).at(-1)).toEqual({
      action: "container_run.finished",
      actor: null,
      target: `container_run:${runId}`,
      metadata: { digits: 1000, durationMs: 7000, failure: null },
    });
  });

  it("fails the running step with its code and skips the rest", async () => {
    const ada = await seedUser("Ada Finish Fail");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-finish-fail" });
    const runId = await startRun(actor, 50_000);
    await advanceRun(runId, ["starting"]);

    await finishContainerRun(
      containerDeps({ at: "2026-10-28T12:01:00.000Z" }),
      {
        runId,
        outcome: "failed",
        errorCode: "container_unavailable",
      }
    );
    const [row] = await rows(
      "SELECT status, error_code, steps FROM container_runs WHERE id = ?",
      runId
    );
    expect(row).toMatchObject({
      status: "failed",
      error_code: "container_unavailable",
    });
    expect(
      JSON.parse(String(row?.steps)).map((s: { status: string }) => s.status)
    ).toEqual(["done", "failed", "skipped", "skipped", "skipped", "skipped"]);
    const [event] = await rows(
      "SELECT outcome, actor_kind FROM audit_events WHERE action = 'container_run.finished' AND target_id = ?",
      runId
    );
    expect(event).toEqual({ outcome: "failure", actor_kind: "system" });
  });

  it("leaves a finished run as it is and records nothing more (a retried step)", async () => {
    const ada = await seedUser("Ada Finish Twice");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-finish-twice" });
    const runId = await startRun(actor);
    await finishContainerRun(containerDeps(), {
      runId,
      outcome: "failed",
      errorCode: "compute_failed",
    });
    expect(
      await finishContainerRun(containerDeps(), { runId, outcome: "succeeded" })
    ).toEqual({ changed: false });
    expect(
      (await auditTrail("ws-cr-finish-twice")).filter(
        (event) => event.action === "container_run.finished"
      )
    ).toHaveLength(1);
  });
});
