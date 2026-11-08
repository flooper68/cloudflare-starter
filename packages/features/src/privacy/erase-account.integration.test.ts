import { describe, expect, it, vi } from "vitest";
import { rows } from "../../test/fixtures";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { eraseAccount } from "./erase-account";

describe("eraseAccount", () => {
  it("runs the erasers, deletes the user through the gateway and audits workspaces as the actor", async () => {
    const { deps, person, actor } = await privacyFixture();
    const gateway = memoryAdminAuthGateway();
    const eraseUserArtifacts = vi.fn();
    const eraseWorkspaceArtifacts = vi.fn();

    const plan = await eraseAccount(
      { ...deps, gateway, eraseUserArtifacts, eraseWorkspaceArtifacts },
      { userId: person.id, actor: { kind: "system" } }
    );

    expect(plan.deletedWorkspaceIds).toEqual([actor.workspaceId]);
    expect(eraseWorkspaceArtifacts).toHaveBeenCalledWith(
      [actor.workspaceId],
      person.id
    );
    expect(eraseUserArtifacts).toHaveBeenCalledWith({
      userId: person.id,
      email: person.email,
    });
    expect(gateway.calls).toEqual([{ op: "deleteUser", userId: person.id }]);
    expect(await rows("SELECT id FROM user WHERE id = ?", person.id)).toEqual(
      []
    );
    expect(
      await rows(
        "SELECT actor_kind FROM audit_events WHERE action = 'workspace.deleted' AND target_id = ?",
        actor.workspaceId
      )
    ).toEqual([{ actor_kind: "system" }]);
  });

  it("does nothing for a user that no longer exists", async () => {
    const { deps } = await privacyFixture();
    const gateway = memoryAdminAuthGateway();
    const plan = await eraseAccount(
      {
        ...deps,
        gateway,
        eraseUserArtifacts: vi.fn(),
        eraseWorkspaceArtifacts: vi.fn(),
      },
      { userId: "user-gone", actor: { kind: "system" } }
    );
    expect(plan).toEqual({ deletedWorkspaceIds: [], leftWorkspaceIds: [] });
  });
});
