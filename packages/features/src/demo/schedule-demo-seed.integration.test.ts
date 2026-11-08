import { describe, expect, it } from "vitest";

import { demoOn } from "../../test/demo-fixtures";
import { testRequestContext, useCaseDeps } from "../../test/fixtures";
import { scheduleDemoSeed } from "./schedule-demo-seed";

const input = {
  userId: "user-new",
  workspaceId: "personal-user-new",
  context: testRequestContext(),
};

describe("scheduleDemoSeed", () => {
  it("enqueues demo.seed-workspace for the new personal workspace, as its user", async () => {
    const deps = { ...useCaseDeps(), demo: demoOn() };
    expect(await scheduleDemoSeed(deps, input)).toBe(true);
    expect(deps.jobQueue.sent.map((sent) => sent.envelope)).toEqual([
      expect.objectContaining({
        type: "demo.seed-workspace",
        data: { userId: "user-new", workspaceId: "personal-user-new" },
        idempotencykey: "demo.seed-workspace:personal-user-new",
        userid: "user-new",
        workspaceid: "personal-user-new",
      }),
    ]);
  });

  it("enqueues nothing with demo mode or sample data off, in single mode, or without a workspace", async () => {
    for (const [demo, workspaceId] of [
      [{ mode: "off" } as const, input.workspaceId],
      [demoOn({ sampleData: false }), input.workspaceId],
      [demoOn({ workspaceMode: "single" }), input.workspaceId],
      [demoOn(), null],
    ] as const) {
      const deps = { ...useCaseDeps(), demo };
      expect(await scheduleDemoSeed(deps, { ...input, workspaceId })).toBe(
        false
      );
      expect(deps.jobQueue.sent).toEqual([]);
    }
  });
});
