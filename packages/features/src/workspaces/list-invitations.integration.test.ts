import { describe, expect, it } from "vitest";

import {
  addMember,
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { listInvitations } from "./list-invitations";

describe("listInvitations", () => {
  it("lists open invitations of the workspace with their status, to managers only", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const other = await seedWorkspace(owner.id, { id: "ws-other" });
    await invite(actor, "old@example.test", "member", {
      at: "2026-10-01T00:00:00.000Z",
    });
    await invite(actor, "new@example.test", "owner");
    await invite(other, "elsewhere@example.test");

    const deps = { db: testDb(), clock: fixedClock() };
    expect(
      (await listInvitations(deps, actor, { mode: "multi" })).map((i) => [
        i.email,
        i.role,
        i.status,
      ])
    ).toEqual([
      ["new@example.test", "owner", "pending"],
      ["old@example.test", "member", "expired"],
    ]);
    await expect(
      listInvitations(deps, member, { mode: "multi" })
    ).rejects.toMatchObject({ name: "ActionNotAllowedError" });
    await expect(
      listInvitations(deps, actor, { mode: "personal" })
    ).rejects.toMatchObject({ name: "WorkspaceModeError" });
  });
});
