import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { removeMember } from "./remove-member";

describe("removeMember", () => {
  it("removes members but not the last owner, and only for managers", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const deps = useCaseDeps();

    await expect(
      removeMember(deps, member, { mode: "multi", userId: owner.id })
    ).rejects.toMatchObject({ name: "ActionNotAllowedError" });
    await expect(
      removeMember(deps, actor, { mode: "multi", userId: owner.id })
    ).rejects.toMatchObject({ name: "LastOwnerError" });
    await expect(
      removeMember(deps, actor, { mode: "multi", userId: "nobody" })
    ).rejects.toMatchObject({ name: "MemberNotFoundError" });

    expect(
      await removeMember(deps, actor, { mode: "multi", userId: colleague.id })
    ).toEqual({ removed: true });
    expect(await auditTrail("ws-acme")).toEqual([
      expect.objectContaining({
        action: "workspace.member_removed",
        target: `user:${colleague.id}`,
        metadata: { role: "member" },
      }),
    ]);
    expect(await rows("SELECT user_id FROM workspace_members")).toEqual([
      { user_id: owner.id },
    ]);
  });
});
