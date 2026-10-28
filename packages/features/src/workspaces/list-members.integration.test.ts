import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { listMembers } from "./list-members";

describe("listMembers", () => {
  it("lists the workspace's members to every member, and nothing in personal mode", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const stranger = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    await seedWorkspace(stranger.id, { id: "ws-other" });

    const members = await listMembers({ db: testDb() }, member, {
      mode: "multi",
    });
    expect(members.map((m) => [m.name, m.email, m.role])).toEqual([
      ["Ada Lovelace", "ada.lovelace@example.test", "owner"],
      ["Grace Hopper", "grace.hopper@example.test", "member"],
    ]);
    await expect(
      listMembers({ db: testDb() }, actor, { mode: "personal" })
    ).rejects.toMatchObject({ name: "WorkspaceModeError", kind: "forbidden" });
  });
});
