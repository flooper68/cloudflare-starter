import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { leaveWorkspace } from "./leave-workspace";

describe("leaveWorkspace", () => {
  it("lets members leave, not the last owner, and never a personal workspace", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const personal = await seedWorkspace(owner.id, {
      id: "ws-p",
      kind: "personal",
    });
    const deps = useCaseDeps();

    await expect(
      leaveWorkspace(deps, actor, { mode: "multi" })
    ).rejects.toMatchObject({
      name: "LastOwnerError",
    });
    await expect(
      leaveWorkspace(deps, personal, { mode: "multi" })
    ).rejects.toMatchObject({
      name: "PersonalWorkspaceError",
    });
    await expect(
      leaveWorkspace(deps, member, { mode: "personal" })
    ).rejects.toMatchObject({
      name: "WorkspaceModeError",
    });

    expect(await leaveWorkspace(deps, member, { mode: "multi" })).toEqual({
      left: true,
    });
    expect(await auditTrail("ws-acme")).toEqual([
      expect.objectContaining({
        action: "workspace.member_left",
        target: `user:${colleague.id}`,
      }),
    ]);
    expect(
      await rows(
        "SELECT user_id FROM workspace_members WHERE workspace_id = 'ws-acme'"
      )
    ).toEqual([{ user_id: owner.id }]);
  });

  it("lets only one of two owners leaving at the same time go", async () => {
    const ada = await seedUser("Ada Two");
    const grace = await seedUser("Grace Two");
    const first = await seedWorkspace(ada.id, { id: "ws-two" });
    const second = await addMember("ws-two", grace.id, "owner");
    const deps = useCaseDeps();

    const results = await Promise.allSettled([
      leaveWorkspace(deps, first, { mode: "multi" }),
      leaveWorkspace(deps, second, { mode: "multi" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await rows(
        "SELECT role FROM workspace_members WHERE workspace_id = 'ws-two'"
      )
    ).toEqual([{ role: "owner" }]);
  });
});
