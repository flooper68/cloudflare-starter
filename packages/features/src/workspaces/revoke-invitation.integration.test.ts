import { describe, expect, it } from "vitest";

import {
  invite,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { previewInvitation } from "./preview-invitation";
import { revokeInvitation } from "./revoke-invitation";

describe("revokeInvitation", () => {
  it("revokes an open invitation of the actor's workspace once", async () => {
    const owner = await seedUser("Ada Lovelace");
    const stranger = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const elsewhere = await seedWorkspace(stranger.id, { id: "ws-other" });
    const { id, token } = await invite(actor, "grace@example.test");
    const deps = useCaseDeps();

    await expect(
      revokeInvitation(deps, elsewhere, { mode: "multi", invitationId: id })
    ).rejects.toMatchObject({ name: "InvitationNotFoundError" });
    expect(
      await revokeInvitation(deps, actor, { mode: "multi", invitationId: id })
    ).toEqual({ revoked: true });
    expect((await previewInvitation(deps, { token })).status).toBe("revoked");
    await expect(
      revokeInvitation(deps, actor, { mode: "multi", invitationId: id })
    ).rejects.toMatchObject({ name: "InvitationNotFoundError" });
  });
});
