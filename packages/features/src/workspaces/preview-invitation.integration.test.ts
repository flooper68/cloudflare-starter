import { describe, expect, it } from "vitest";

import {
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { previewInvitation } from "./preview-invitation";

describe("previewInvitation", () => {
  it("shows the workspace, inviter, email, role and status behind a token", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, {
      id: "ws-acme",
      name: "Acme Robotics",
    });
    const { token } = await invite(actor, "grace@example.test", "owner");

    expect(
      await previewInvitation({ db: testDb(), clock: fixedClock() }, { token })
    ).toEqual({
      status: "pending",
      workspaceId: "ws-acme",
      workspaceName: "Acme Robotics",
      inviterName: "Ada Lovelace",
      email: "grace@example.test",
      role: "owner",
      expiresAt: "2026-11-04T12:00:00.000Z",
    });
    expect(
      (
        await previewInvitation(
          { db: testDb(), clock: fixedClock("2026-12-01T00:00:00.000Z") },
          { token }
        )
      ).status
    ).toBe("expired");
  });

  it("does not find an unknown token", async () => {
    await expect(
      previewInvitation(
        { db: testDb(), clock: fixedClock() },
        { token: "nope" }
      )
    ).rejects.toMatchObject({ name: "InvitationNotFoundError" });
  });
});
