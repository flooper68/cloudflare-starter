import { describe, expect, it } from "vitest";

import {
  addMember,
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { countWorkspaceSeats } from "./count-workspace-seats";

describe("countWorkspaceSeats", () => {
  it("counts members and pending invitations, not expired ones", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-count" });
    await addMember(actor.workspaceId, colleague.id);
    await invite(actor, "alan@example.test");
    await invite(actor, "old@example.test", "member", {
      at: "2026-09-01T00:00:00.000Z",
    });
    const count = (at?: string) =>
      countWorkspaceSeats(
        { db: testDb(), clock: fixedClock(at) },
        { workspaceId: actor.workspaceId }
      );
    expect(await count()).toBe(3);
    // A week later the second invitation has expired as well.
    expect(await count("2026-11-05T12:00:00.000Z")).toBe(2);
  });
});
