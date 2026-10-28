import { describe, expect, it } from "vitest";

import { billingDeps, seedUser, seedWorkspace } from "../../test/fixtures";
import { assertFeature } from "./assert-feature";
import { FeatureNotIncludedError } from "./domain";
import { setOverride } from "./set-override";

describe("assertFeature", () => {
  it("refuses a feature the plan lacks with limit_reached and upgrade options", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-free" });
    const refused = assertFeature(
      billingDeps(),
      actor.workspaceId,
      "files.presigned_upload"
    );
    await expect(refused).rejects.toBeInstanceOf(FeatureNotIncludedError);
    await expect(refused).rejects.toMatchObject({
      kind: "limit_reached",
      details: {
        feature: "files.presigned_upload",
        planId: "free",
        upgrade: { planIds: ["pro"], addonIds: ["direct_uploads"] },
      },
    });
  });

  it("passes once an override grants it, and always with billing off", async () => {
    const owner = await seedUser("Ada Lovelace");
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-granted" });
    await expect(
      assertFeature(
        billingDeps("off"),
        actor.workspaceId,
        "files.presigned_upload"
      )
    ).resolves.toBeUndefined();
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "files.presigned_upload",
        override: { kind: "feature", enabled: true },
        reason: "Beta tester",
      }
    );
    await expect(
      assertFeature(billingDeps(), actor.workspaceId, "files.presigned_upload")
    ).resolves.toBeUndefined();
  });

  it("treats an unknown feature key as a programming error", async () => {
    await expect(
      assertFeature(billingDeps("off"), "ws-any", "files.teleport")
    ).rejects.toThrow(/Unknown billing feature files\.teleport/);
  });
});
