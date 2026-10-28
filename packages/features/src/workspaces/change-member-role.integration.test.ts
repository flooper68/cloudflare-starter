import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  notificationsSent,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { changeMemberRole } from "./change-member-role";

describe("changeMemberRole", () => {
  it("changes a role but never demotes the last owner", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const deps = useCaseDeps();

    await expect(
      changeMemberRole(deps, actor, {
        mode: "multi",
        userId: owner.id,
        role: "member",
      })
    ).rejects.toMatchObject({ name: "LastOwnerError", kind: "conflict" });
    await expect(
      changeMemberRole(deps, member, {
        mode: "multi",
        userId: owner.id,
        role: "member",
      })
    ).rejects.toMatchObject({ name: "ActionNotAllowedError" });
    await expect(
      changeMemberRole(deps, actor, {
        mode: "multi",
        userId: "nobody",
        role: "owner",
      })
    ).rejects.toMatchObject({ name: "MemberNotFoundError" });

    expect(
      await changeMemberRole(deps, actor, {
        mode: "multi",
        userId: colleague.id,
        role: "owner",
      })
    ).toEqual({ userId: colleague.id, role: "owner" });
    // With a second owner, the first may step down.
    await changeMemberRole(deps, actor, {
      mode: "single",
      userId: owner.id,
      role: "member",
    });
    expect(await auditTrail("ws-acme")).toEqual([
      expect.objectContaining({
        action: "workspace.member_role_changed",
        actor: owner.id,
        target: `user:${colleague.id}`,
        metadata: { previousRole: "member", role: "owner" },
      }),
      expect.objectContaining({
        action: "workspace.member_role_changed",
        target: `user:${owner.id}`,
        metadata: { previousRole: "owner", role: "member" },
      }),
    ]);
    expect(
      await rows("SELECT user_id, role FROM workspace_members ORDER BY role")
    ).toEqual([
      { user_id: owner.id, role: "member" },
      { user_id: colleague.id, role: "owner" },
    ]);
    // Each changed member hears about it (the test context has no actor to drop).
    expect(notificationsSent(deps.jobQueue)).toEqual([
      expect.objectContaining({
        type: "workspaces.role-changed",
        recipients: [colleague.id],
        data: {
          workspaceId: "ws-acme",
          workspaceName: "Acme Robotics",
          role: "owner",
          previousRole: "member",
        },
      }),
      expect.objectContaining({
        type: "workspaces.role-changed",
        recipients: [owner.id],
      }),
    ]);
  });

  it("sends nothing when the role stays the same, and never to the actor", async () => {
    const owner = await seedUser("Edsger Dijkstra");
    const colleague = await seedUser("Frances Allen");
    const actor = await seedWorkspace(owner.id, { id: "ws-same" });
    await addMember("ws-same", colleague.id, "owner");
    const deps = useCaseDeps();
    const asOwner = {
      ...deps,
      requestContext: { ...deps.requestContext, userId: owner.id },
    };
    await changeMemberRole(asOwner, actor, {
      mode: "multi",
      userId: colleague.id,
      role: "owner",
    });
    await changeMemberRole(asOwner, actor, {
      mode: "multi",
      userId: owner.id,
      role: "member",
    });
    expect(notificationsSent(deps.jobQueue)).toEqual([]);
  });
});
