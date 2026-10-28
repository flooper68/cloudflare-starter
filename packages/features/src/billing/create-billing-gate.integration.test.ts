import { describe, expect, it } from "vitest";

import {
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { createBillingGate } from "./create-billing-gate";

describe("createBillingGate", () => {
  it("binds the billing use cases for other features", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-gate" });
    const gate = createBillingGate(billingDeps());

    // No subscription: the free plan, which lacks direct uploads.
    await expect(
      gate.requireFeature(actor.workspaceId, "files.presigned_upload")
    ).rejects.toMatchObject({ kind: "limit_reached" });

    await gate.workspaceCreated(actor.workspaceId);
    await expect(
      gate.requireFeature(actor.workspaceId, "files.presigned_upload")
    ).resolves.toBeUndefined();
    await expect(
      gate.requireLimit(actor.workspaceId, "seats", 24)
    ).resolves.toBeUndefined();
    await expect(
      gate.requireLimit(actor.workspaceId, "seats", 25)
    ).rejects.toMatchObject({ kind: "limit_reached" });

    await gate.recordUsage(actor.workspaceId, "files.uploads_per_month", 3);
    expect(
      await rows(
        "SELECT value FROM usage_counter WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([{ value: 3 }]);
  });
});
