import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { resolveActor } from "./resolve-actor";
import { switchWorkspace } from "./switch-workspace";

describe("switchWorkspace", () => {
  it("multi mode: makes the workspace the user's default", async () => {
    const ada = await seedUser("Ada Lovelace");
    const first = await seedWorkspace(ada.id, { id: "ws-a" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await seedWorkspace(ada.id, { id: "ws-b" });
    const deps = { db: testDb(), clock: fixedClock() };

    expect(
      (await resolveActor(deps, { userId: ada.id, mode: "multi" })).workspaceId
    ).toBe("ws-b");
    expect(await switchWorkspace(deps, first, { mode: "multi" })).toEqual({
      workspaceId: "ws-a",
    });
    expect(
      (await resolveActor(deps, { userId: ada.id, mode: "multi" })).workspaceId
    ).toBe("ws-a");
  });

  it("is refused outside multi mode", async () => {
    const ken = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(ken.id);
    await expect(
      switchWorkspace({ db: testDb(), clock: fixedClock() }, actor, {
        mode: "single",
      })
    ).rejects.toMatchObject({ name: "WorkspaceModeError" });
  });
});
