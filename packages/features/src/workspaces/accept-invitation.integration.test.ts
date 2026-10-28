import { describe, expect, it } from "vitest";

import {
  auditTrail,
  invite,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { acceptInvitation } from "./accept-invitation";

const deps = (at?: string) => useCaseDeps(at);

describe("acceptInvitation", () => {
  it("adds the invited user with the invitation's role, once, and makes the workspace active", async () => {
    const owner = await seedUser("Ada Lovelace");
    const grace = await seedUser("Grace Hopper", "grace@example.test");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const { token } = await invite(actor, "Grace@Example.test", "owner");

    const accepting = deps();
    expect(
      await acceptInvitation(accepting, {
        mode: "multi",
        token,
        user: grace,
      })
    ).toEqual({ workspaceId: "ws-acme" });
    // Product analytics: the join, then the member's traits (two members now).
    expect(
      accepting.analytics.recorded.map((call) => [
        call.event,
        call.properties,
        call.context.userId,
        call.context.workspaceId,
      ])
    ).toEqual([
      [
        "workspaces.member_joined",
        { role: "owner", via: "invitation" },
        grace.id,
        "ws-acme",
      ],
      [
        "$identify",
        { role: "owner", workspace_size: "2-5", plan: null },
        grace.id,
        "ws-acme",
      ],
    ]);
    expect(
      await rows(
        "SELECT role, last_active_at FROM workspace_members WHERE user_id = ?",
        grace.id
      )
    ).toEqual([
      { role: "owner", last_active_at: Date.parse("2026-10-28T12:00:00Z") },
    ]);

    expect((await auditTrail("ws-acme")).map((event) => event.action)).toEqual([
      "workspace.invitation_created",
      "workspace.invitation_accepted",
    ]);

    // The same member again: a no-op success, not a second membership.
    expect(
      await acceptInvitation(deps(), { mode: "multi", token, user: grace })
    ).toEqual({ workspaceId: "ws-acme" });
  });

  it("refuses another account, an expired, a revoked, a used or an unknown link", async () => {
    const owner = await seedUser("Barbara Liskov");
    const alan = await seedUser("Alan Turing", "alan@example.test");
    const ken = await seedUser("Ken Thompson", "ken@example.test");
    const actor = await seedWorkspace(owner.id, { id: "ws-b" });

    const forAlan = await invite(actor, "alan@example.test");
    await expect(
      acceptInvitation(deps(), {
        mode: "multi",
        token: forAlan.token,
        user: ken,
      })
    ).rejects.toMatchObject({ name: "InvitationWrongAccountError" });
    await expect(
      acceptInvitation(deps("2026-11-04T12:00:00.000Z"), {
        mode: "multi",
        token: forAlan.token,
        user: alan,
      })
    ).rejects.toMatchObject({ name: "InvitationExpiredError" });

    // A new invitation for the same email revokes the first link.
    const again = await invite(actor, "alan@example.test");
    await expect(
      acceptInvitation(deps(), {
        mode: "multi",
        token: forAlan.token,
        user: alan,
      })
    ).rejects.toMatchObject({ name: "InvitationNotFoundError" });

    await acceptInvitation(deps(), {
      mode: "multi",
      token: again.token,
      user: alan,
    });
    const forKen = await invite(actor, "ken@example.test");
    await acceptInvitation(deps(), {
      mode: "multi",
      token: forKen.token,
      user: ken,
    });
    await expect(
      acceptInvitation(deps(), {
        mode: "multi",
        token: "f".repeat(64),
        user: ken,
      })
    ).rejects.toMatchObject({ name: "InvitationNotFoundError" });
    await expect(
      acceptInvitation(deps(), {
        mode: "personal",
        token: forKen.token,
        user: ken,
      })
    ).rejects.toMatchObject({ name: "WorkspaceModeError" });
  });

  it("lets only one of two concurrent accepts of the same link through", async () => {
    const owner = await seedUser("Edsger Dijkstra");
    const linus = await seedUser("Linus T", "linus@example.test");
    const actor = await seedWorkspace(owner.id, { id: "ws-c" });
    const { token } = await invite(actor, "linus@example.test");

    const results = await Promise.allSettled([
      acceptInvitation(deps(), { mode: "multi", token, user: linus }),
      acceptInvitation(deps(), { mode: "multi", token, user: linus }),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(
      await rows(
        "SELECT count(*) AS n FROM workspace_members WHERE user_id = ?",
        linus.id
      )
    ).toEqual([{ n: 1 }]);
  });
});
