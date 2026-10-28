import { describe, expect, it } from "vitest";

import {
  addMember,
  notificationsSent,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { transferOwnership } from "./transfer-ownership";

describe("transferOwnership", () => {
  it("swaps owner and member in one step; only owners, only to members", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const deps = useCaseDeps();

    await expect(
      transferOwnership(deps, member, { mode: "multi", userId: colleague.id })
    ).rejects.toMatchObject({ name: "ActionNotAllowedError" });
    await expect(
      transferOwnership(deps, actor, { mode: "multi", userId: owner.id })
    ).rejects.toMatchObject({ name: "TransferToSelfError" });
    await expect(
      transferOwnership(deps, actor, { mode: "multi", userId: "nobody" })
    ).rejects.toMatchObject({ name: "MemberNotFoundError" });

    expect(
      await transferOwnership(deps, actor, {
        mode: "multi",
        userId: colleague.id,
      })
    ).toEqual({ ownerUserId: colleague.id });
    expect(
      await rows("SELECT user_id, role FROM workspace_members ORDER BY role")
    ).toEqual([
      { user_id: owner.id, role: "member" },
      { user_id: colleague.id, role: "owner" },
    ]);
    expect(notificationsSent(deps.jobQueue)).toEqual([
      {
        type: "workspaces.role-changed",
        recipients: [colleague.id],
        workspaceId: "ws-acme",
        data: {
          workspaceId: "ws-acme",
          workspaceName: "Acme Robotics",
          role: "owner",
          previousRole: "member",
        },
      },
    ]);
  });
});
