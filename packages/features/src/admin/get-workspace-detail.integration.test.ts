import { describe, expect, it } from "vitest";

import { NOW, seedAccount } from "../../test/admin-fixtures";
import {
  addMember,
  fixedClock,
  invite,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { WorkspaceModeError, WorkspaceNotFoundError } from "../workspaces";
import { getWorkspaceDetail } from "./get-workspace-detail";

const deps = () => ({ db: testDb(), clock: fixedClock(NOW.toISOString()) });
const admin = { userId: "user-admin" };

describe("getWorkspaceDetail", () => {
  it("shows members, managers and pending invitations", async () => {
    const ada = await seedAccount("Ada Lovelace");
    const grace = await seedAccount("Grace Hopper");
    const owner = await seedWorkspace(ada.id, { id: "ws-a" });
    await addMember("ws-a", grace.id);
    await invite(owner, "alan@example.test", "member", {
      at: NOW.toISOString(),
    });

    const detail = await getWorkspaceDetail(deps(), admin, {
      workspaceId: "ws-a",
      mode: "multi",
    });
    expect(detail).toMatchObject({
      id: "ws-a",
      kind: "shared",
      createdBy: ada.id,
      managerCount: 1,
      pendingInvitations: 1,
    });
    expect(detail.members.map((m) => [m.email, m.role])).toEqual([
      [ada.email, "owner"],
      [grace.email, "member"],
    ]);
  });

  it("not found for an unknown workspace; not offered in personal mode", async () => {
    await expect(
      getWorkspaceDetail(deps(), admin, { workspaceId: "ws-x", mode: "multi" })
    ).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      getWorkspaceDetail(deps(), admin, {
        workspaceId: "ws-a",
        mode: "personal",
      })
    ).rejects.toThrow(WorkspaceModeError);
  });
});
