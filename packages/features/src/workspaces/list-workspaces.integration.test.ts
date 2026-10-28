import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { listWorkspaces } from "./list-workspaces";

describe("listWorkspaces", () => {
  it("lists the user's workspaces with their role, the default first", async () => {
    const ada = await seedUser("Ada Lovelace");
    const grace = await seedUser("Grace Hopper");
    await seedWorkspace(ada.id, {
      id: "ws-p",
      name: "Personal",
      kind: "personal",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await seedWorkspace(grace.id, { id: "ws-g", name: "Grace's team" });
    await addMember("ws-g", ada.id);

    expect(await listWorkspaces({ db: testDb() }, { userId: ada.id })).toEqual({
      activeWorkspaceId: "ws-g",
      items: [
        { id: "ws-g", name: "Grace's team", kind: "shared", role: "member" },
        { id: "ws-p", name: "Personal", kind: "personal", role: "owner" },
      ],
    });
    expect(
      await listWorkspaces({ db: testDb() }, { userId: "nobody" })
    ).toEqual({
      activeWorkspaceId: null,
      items: [],
    });
  });
});
