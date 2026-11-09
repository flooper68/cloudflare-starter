import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import {
  notificationsSent,
  rows,
  seedUser,
  seedWorkspace,
  testRequestContext,
} from "../../test/fixtures";
import { notifyContainerRunFinished } from "./notify-container-run-finished";

/** The workflow's context: no user, so the starter is not dropped as the actor. */
const workflowContext = testRequestContext({ source: "workflow", ip: null });

describe("notifyContainerRunFinished", () => {
  it("tells the person who started the run, in its workspace", async () => {
    const ada = await seedUser("Ada Notify");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-notify" });
    const runId = await startRun(actor, 10_000);
    const deps = { ...containerDeps(), requestContext: workflowContext };

    const sent = await notifyContainerRunFinished(deps, {
      runId,
      outcome: "succeeded",
    });
    expect(sent).toMatchObject({ status: "enqueued", recipients: 1 });
    expect(notificationsSent(deps.jobQueue)).toEqual([
      expect.objectContaining({
        type: "container-runs.finished",
        data: { runId, digits: 10_000, outcome: "succeeded" },
        recipients: [ada.id],
        workspaceId: "ws-cr-notify",
      }),
    ]);
  });

  it("tells nobody once the starter's account is gone", async () => {
    const ada = await seedUser("Ada Notify Gone");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-notify-gone" });
    const runId = await startRun(actor);
    await rows(
      "UPDATE container_runs SET created_by = NULL WHERE id = ?",
      runId
    );
    const deps = { ...containerDeps(), requestContext: workflowContext };
    expect(
      await notifyContainerRunFinished(deps, { runId, outcome: "failed" })
    ).toEqual({ status: "nobody" });
    expect(notificationsSent(deps.jobQueue)).toEqual([]);
  });
});
