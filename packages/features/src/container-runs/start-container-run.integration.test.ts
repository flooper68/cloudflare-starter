import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { finishContainerRun } from "./finish-container-run";
import { startContainerRun } from "./start-container-run";

describe("startContainerRun", () => {
  it("writes a queued run, starts its workflow, audits and tracks it", async () => {
    const ada = await seedUser("Ada Start");
    const grace = await seedUser("Grace Start");
    const owner = await seedWorkspace(ada.id, { id: "ws-cr-start" });
    const member = await addMember(owner.workspaceId, grace.id);
    const deps = containerDeps();

    const started = await startContainerRun(deps, member, { digits: 10_000 });

    expect(started).toEqual({ runId: expect.any(String), status: "queued" });
    expect(deps.workflows.started).toEqual([started.runId]);
    const [row] = await rows(
      "SELECT workspace_id, created_by, digits, status, steps, created_at, expires_at FROM container_runs WHERE id = ?",
      started.runId
    );
    expect(row).toMatchObject({
      workspace_id: "ws-cr-start",
      created_by: grace.id,
      digits: 10_000,
      status: "queued",
      created_at: Date.parse("2026-10-28T12:00:00.000Z"),
      expires_at: Date.parse("2026-11-04T12:00:00.000Z"),
    });
    expect(JSON.parse(String(row?.steps))[0]).toMatchObject({
      name: "queued",
      status: "running",
    });
    expect(await auditTrail("ws-cr-start")).toEqual([
      expect.objectContaining({
        action: "container_run.started",
        actor: grace.id,
        target: `container_run:${started.runId}`,
        metadata: { digits: 10_000, retryOf: null },
      }),
    ]);
    expect(
      deps.analytics.recorded.map((call) => [call.event, call.properties])
    ).toEqual([["container_runs.started", { digits: "10000", kind: "new" }]]);
  });

  it("refuses while CONTAINER_DEMO is off, before anything is written", async () => {
    const ada = await seedUser("Ada Off");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-off" });
    const deps = containerDeps({ settings: { mode: "off" } });
    await expect(
      startContainerRun(deps, actor, { digits: 1000 })
    ).rejects.toMatchObject({
      kind: "unavailable",
      code: "CONTAINER_DEMO_OFF",
    });
    expect(
      await rows(
        "SELECT id FROM container_runs WHERE workspace_id = ?",
        "ws-cr-off"
      )
    ).toEqual([]);
    expect(deps.workflows.started).toEqual([]);
  });

  it("keeps the hourly limit when the workspace with the runs is deleted", async () => {
    const ada = await seedUser("Ada Hourly Delete");
    const kept = await seedWorkspace(ada.id, { id: "ws-cr-hourly-kept" });
    const gone = await seedWorkspace(ada.id, { id: "ws-cr-hourly-gone" });
    for (let index = 0; index < 5; index += 1) {
      await startRun(gone, 1000, "2026-10-28T15:05:00.000Z");
    }
    await rows("DELETE FROM workspaces WHERE id = ?", "ws-cr-hourly-gone");
    await expect(
      startContainerRun(
        containerDeps({ at: "2026-10-28T15:10:00.000Z" }),
        kept,
        { digits: 1000 }
      )
    ).rejects.toMatchObject({ code: "CONTAINER_RUN_HOURLY_LIMIT" });
  });

  it("gives the hour's slot back when the daily cap refuses the run", async () => {
    const ada = await seedUser("Ada Slot Back");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-slot-back" });
    const at = "2026-10-31T09:00:00.000Z";
    await startContainerRun(
      containerDeps({ at, settings: { dailyCap: 1 } }),
      actor,
      { digits: 1000 }
    );
    await expect(
      startContainerRun(
        containerDeps({ at, settings: { dailyCap: 1 } }),
        actor,
        {
          digits: 1000,
        }
      )
    ).rejects.toMatchObject({ code: "CONTAINER_DEMO_DAILY_CAP" });
    expect(
      await rows(
        "SELECT count FROM container_run_user_quota WHERE user_id = ? AND hour = ?",
        ada.id,
        "2026-10-31T09"
      )
    ).toEqual([{ count: 1 }]);
  });

  it("limits a user to 5 runs an hour across workspaces; the next UTC hour they may run again", async () => {
    const ada = await seedUser("Ada Hourly");
    const first = await seedWorkspace(ada.id, { id: "ws-cr-hourly-1" });
    const second = await seedWorkspace(ada.id, { id: "ws-cr-hourly-2" });
    for (const actor of [first, first, first, second, second]) {
      await startRun(actor, 1000, "2026-10-28T12:00:00.000Z");
    }
    await expect(
      startContainerRun(
        containerDeps({ at: "2026-10-28T12:30:00.000Z" }),
        first,
        {
          digits: 1000,
        }
      )
    ).rejects.toMatchObject({
      kind: "rate_limited",
      code: "CONTAINER_RUN_HOURLY_LIMIT",
      details: { limit: 5 },
    });
    await expect(
      startContainerRun(
        containerDeps({ at: "2026-10-28T13:00:01.000Z" }),
        first,
        {
          digits: 1000,
        }
      )
    ).resolves.toMatchObject({ status: "queued" });
  });

  it("stops at the daily cap for the whole deployment and opens again the next UTC day", async () => {
    const users = await Promise.all(
      ["Ada", "Grace", "Alan"].map((name) => seedUser(`${name} Cap`))
    );
    const [first, second, third] = await Promise.all(
      users.map((user, index) =>
        seedWorkspace(user.id, { id: `ws-cr-cap-${index}` })
      )
    );
    if (!first || !second || !third) throw new Error("seeding failed");
    const at = "2026-10-29T08:00:00.000Z";
    const capped = (time = at) =>
      containerDeps({ at: time, settings: { dailyCap: 2 } });
    await startContainerRun(capped(), first, { digits: 1000 });
    await startContainerRun(capped(), second, { digits: 1000 });
    const deps = capped();
    await expect(
      startContainerRun(deps, third, { digits: 1000 })
    ).rejects.toMatchObject({
      kind: "rate_limited",
      code: "CONTAINER_DEMO_DAILY_CAP",
      details: { dailyCap: 2 },
    });
    expect(deps.workflows.started).toEqual([]);
    expect(
      await rows(
        "SELECT count FROM container_run_quota WHERE day = ?",
        "2026-10-29"
      )
    ).toEqual([{ count: 2 }]);

    // Deleting the workspace (and its runs) does not give the day's runs back.
    await rows("DELETE FROM workspaces WHERE id = ?", "ws-cr-cap-0");
    await expect(
      startContainerRun(capped(), third, { digits: 1000 })
    ).rejects.toMatchObject({ code: "CONTAINER_DEMO_DAILY_CAP" });

    await expect(
      startContainerRun(capped("2026-10-30T00:00:00.000Z"), third, {
        digits: 1000,
      })
    ).resolves.toMatchObject({ status: "queued" });
  });

  it("retries a failed run of the same workspace with its digits", async () => {
    const ada = await seedUser("Ada Retry");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-retry" });
    const failed = await startRun(actor, 50_000);
    await finishContainerRun(containerDeps(), {
      runId: failed,
      outcome: "failed",
      errorCode: "container_unavailable",
    });
    const deps = containerDeps();
    const retry = await startContainerRun(deps, actor, { retryOf: failed });
    expect(
      await rows(
        "SELECT digits, retry_of FROM container_runs WHERE id = ?",
        retry.runId
      )
    ).toEqual([{ digits: 50_000, retry_of: failed }]);
    expect(deps.analytics.recorded.at(-1)?.properties).toEqual({
      digits: "50000",
      kind: "retry",
    });
  });

  it("refuses to retry a run that did not fail, or one of another workspace", async () => {
    const ada = await seedUser("Ada Retry No");
    const bob = await seedUser("Bob Retry No");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-retry-no" });
    const other = await seedWorkspace(bob.id, { id: "ws-cr-retry-other" });
    const queued = await startRun(actor);
    await expect(
      startContainerRun(containerDeps(), actor, { retryOf: queued })
    ).rejects.toMatchObject({ code: "CONTAINER_RUN_NOT_RETRYABLE" });
    await expect(
      startContainerRun(containerDeps(), other, { retryOf: queued })
    ).rejects.toMatchObject({ kind: "not_found" });
  });

  it("fails the run when its workflow cannot start, and rethrows", async () => {
    const ada = await seedUser("Ada Workflow Down");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-wf-down" });
    await expect(
      startContainerRun(containerDeps({ failWorkflow: true }), actor, {
        digits: 1000,
      })
    ).rejects.toThrow("workflow binding unavailable");
    const [row] = await rows(
      "SELECT status, error_code FROM container_runs WHERE workspace_id = ?",
      "ws-cr-wf-down"
    );
    expect(row).toEqual({
      status: "failed",
      error_code: "workflow_unavailable",
    });
  });

  it("refuses digits outside the presets", async () => {
    const ada = await seedUser("Ada Presets");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-presets" });
    await expect(
      startContainerRun(containerDeps(), actor, {
        digits: 99_999 as 1000,
      })
    ).rejects.toThrow();
  });
});
