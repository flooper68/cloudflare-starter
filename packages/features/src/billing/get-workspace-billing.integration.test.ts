import { describe, expect, it } from "vitest";

import { billingDeps, seedUser, seedWorkspace } from "../../test/fixtures";
import { WorkspaceNotFoundError } from "../workspaces";
import { getWorkspaceBilling } from "./get-workspace-billing";
import { setOverride } from "./set-override";

describe("getWorkspaceBilling", () => {
  it("shows an admin a workspace's subscription, overrides and entitlements", async () => {
    const owner = await seedUser();
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-admin-view" });
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "seats",
        override: { kind: "limit", limit: 10 },
        reason: "Agreed in the sales call",
      }
    );
    expect(
      await getWorkspaceBilling(billingDeps(), {
        workspaceId: actor.workspaceId,
      })
    ).toMatchObject({
      workspaceId: actor.workspaceId,
      mode: "manual",
      planId: "free",
      status: null,
      provider: null,
      overrides: [{ key: "seats", kind: "limit", limit: 10 }],
      entitlements: { limits: { seats: 10 } },
    });
  });

  it("is not found for an unknown workspace", async () => {
    await expect(
      getWorkspaceBilling(billingDeps(), { workspaceId: "ws-missing" })
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});
