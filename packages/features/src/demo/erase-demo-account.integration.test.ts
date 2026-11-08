import { beforeEach, describe, expect, it } from "vitest";

import {
  daysBefore,
  resetDemoState,
  retentionDeps,
  seedDemoUser,
  userExists,
} from "../../test/demo-fixtures";
import {
  addMember,
  rows,
  seedWorkspace,
  userAuditTrail,
} from "../../test/fixtures";
import { LastOwnerError } from "../workspaces";
import { eraseDemoAccount } from "./erase-demo-account";

describe("eraseDemoAccount", () => {
  beforeEach(resetDemoState);

  it("erases the account through the privacy erasure as the system and audits it", async () => {
    const visitor = await seedDemoUser("erase@example.test", daysBefore(8));
    const deps = retentionDeps();
    const plan = await eraseDemoAccount(deps, {
      userId: visitor.id,
      retentionDays: 7,
    });
    expect(plan.deletedWorkspaceIds).toEqual([visitor.workspaceId]);
    expect(deps.gateway.deleted).toEqual([visitor.id]);
    expect(await userExists(visitor.id)).toBe(false);
    expect(
      (await userAuditTrail(visitor.id)).map((event) => event.action)
    ).toEqual(["privacy.user_erased", "demo.account_erased"]);
    expect(
      await rows(
        "SELECT completed_at IS NOT NULL AS done FROM erasure_records WHERE user_id = ?",
        visitor.id
      )
    ).toEqual([{ done: 1 }]);
  });

  it("refuses, changing nothing, while the account is the last owner of a workspace others use", async () => {
    const owner = await seedDemoUser("owner2@example.test", daysBefore(8));
    const member = await seedDemoUser("member2@example.test", daysBefore(1));
    const shared = await seedWorkspace(owner.id, { id: "ws-erase-shared" });
    await addMember(shared.workspaceId, member.id);
    const deps = retentionDeps();
    await expect(
      eraseDemoAccount(deps, { userId: owner.id, retentionDays: 7 })
    ).rejects.toBeInstanceOf(LastOwnerError);
    expect(await userExists(owner.id)).toBe(true);
    expect(deps.gateway.deleted).toEqual([]);
    expect(
      await rows("SELECT id FROM workspaces WHERE id = ?", owner.workspaceId)
    ).toHaveLength(1);
  });
});
