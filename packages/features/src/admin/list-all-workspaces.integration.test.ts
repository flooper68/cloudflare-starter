import { describe, expect, it } from "vitest";

import { seedAccount } from "../../test/admin-fixtures";
import { addMember, rows, seedWorkspace, testDb } from "../../test/fixtures";
import { WorkspaceModeError } from "../workspaces";
import { listAllWorkspaces } from "./list-all-workspaces";

const admin = { userId: "user-admin" };

describe("listAllWorkspaces", () => {
  it("lists workspaces with member and manager counts, filtered and paged", async () => {
    const ada = await seedAccount("Ada Lovelace");
    const grace = await seedAccount("Grace Hopper");
    await seedWorkspace(ada.id, { id: "ws-a", name: "Analytical Engines" });
    await addMember("ws-a", grace.id);
    await seedWorkspace(grace.id, {
      id: "ws-b",
      name: "Grace",
      kind: "personal",
    });
    // An orphan: its only member is not an owner.
    await seedWorkspace(ada.id, { id: "ws-c", name: "Compilers" });
    await rows(
      "UPDATE workspace_members SET role = 'member' WHERE workspace_id = 'ws-c'"
    );
    await rows("UPDATE workspaces SET created_at = 1 WHERE id = 'ws-a'");
    await rows("UPDATE workspaces SET created_at = 2 WHERE id = 'ws-b'");
    await rows("UPDATE workspaces SET created_at = 3 WHERE id = 'ws-c'");

    const page = await listAllWorkspaces({ db: testDb() }, admin, {
      mode: "multi",
    });
    expect(
      page.items.map((w) => [w.id, w.kind, w.memberCount, w.managerCount])
    ).toEqual([
      ["ws-c", "shared", 1, 0],
      ["ws-b", "personal", 1, 1],
      ["ws-a", "shared", 2, 1],
    ]);

    const ids = async (input: Record<string, unknown>) =>
      (
        await listAllWorkspaces({ db: testDb() }, admin, {
          mode: "multi",
          ...input,
        })
      ).items.map((w) => w.id);
    expect(await ids({ search: "engine" })).toEqual(["ws-a"]);
    expect(await ids({ kind: "personal" })).toEqual(["ws-b"]);
    const first = await listAllWorkspaces({ db: testDb() }, admin, {
      mode: "single",
      limit: 2,
    });
    expect(await ids({ limit: 2, cursor: first.nextCursor ?? "" })).toEqual([
      "ws-a",
    ]);
  });

  it("is not offered in personal mode", async () => {
    await expect(
      listAllWorkspaces({ db: testDb() }, admin, { mode: "personal" })
    ).rejects.toThrow(WorkspaceModeError);
  });
});
