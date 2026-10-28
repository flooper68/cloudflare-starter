import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
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
  });
});
