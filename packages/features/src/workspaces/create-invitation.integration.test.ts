import { describe, expect, it } from "vitest";

import {
  addMember,
  invite,
  rows,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  useCaseDeps,
} from "../../test/fixtures";
import { createMemoryEmail, sha256Hex } from "../platform";
import { createInvitation } from "./create-invitation";

const appUrl = "http://localhost:4321";

describe("createInvitation", () => {
  it("stores only the token's hash, mails the link and expires in 7 days", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, {
      id: "ws-acme",
      name: "Acme <Robotics>",
    });
    const email = createMemoryEmail();
    const sent = email.sent;

    const created = await createInvitation(
      { ...useCaseDeps(), ids: sequentialIds(), email },
      actor,
      { mode: "multi", email: " Grace@Example.TEST ", role: "member", appUrl }
    );
    expect(created).toMatchObject({
      email: "grace@example.test",
      role: "member",
      expiresAt: "2026-11-04T12:00:00.000Z",
      delivered: true,
    });
    const token = created.link.split("/invite/")[1] as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const [stored] = await rows(
      "SELECT email, token_hash, invited_by FROM workspace_invitations"
    );
    expect(stored).toEqual({
      email: "grace@example.test",
      token_hash: await sha256Hex(token),
      invited_by: owner.id,
    });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual({ email: "grace@example.test" });
    expect(sent[0]?.text).toContain(created.link);
    expect(sent[0]?.html).toContain("Acme &lt;Robotics&gt;");
  });

  it("replaces a pending invitation for the same email", async () => {
    const owner = await seedUser("Barbara Liskov");
    const actor = await seedWorkspace(owner.id, { id: "ws-b" });
    const first = await invite(actor, "alan@example.test");
    const second = await invite(actor, "alan@example.test", "owner");

    const all = await rows(
      "SELECT id, role, revoked_at IS NOT NULL AS revoked FROM workspace_invitations WHERE workspace_id = 'ws-b' ORDER BY revoked DESC"
    );
    expect(all).toEqual([
      { id: first.id, role: "member", revoked: 1 },
      { id: second.id, role: "owner", revoked: 0 },
    ]);
  });

  it("refuses members, non-managers, personal workspaces and personal mode", async () => {
    const owner = await seedUser("Grace Hopper");
    const colleague = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-c" });
    const member = await addMember("ws-c", colleague.id);
    const personal = await seedWorkspace(owner.id, {
      id: "ws-p",
      kind: "personal",
    });
    const deps = { ...useCaseDeps(), email: null };
    const input = {
      mode: "multi" as const,
      email: "x@example.test",
      role: "member" as const,
      appUrl,
    };

    await expect(
      createInvitation(deps, actor, { ...input, email: colleague.email })
    ).rejects.toMatchObject({ name: "AlreadyMemberError" });
    await expect(createInvitation(deps, member, input)).rejects.toMatchObject({
      name: "ActionNotAllowedError",
    });
    await expect(createInvitation(deps, personal, input)).rejects.toMatchObject(
      {
        name: "PersonalWorkspaceError",
      }
    );
    await expect(
      createInvitation(deps, actor, { ...input, mode: "personal" })
    ).rejects.toMatchObject({ name: "WorkspaceModeError" });
    await expect(
      createInvitation(deps, actor, { ...input, email: "not-an-email" })
    ).rejects.toThrow();
  });

  it("counts pending invitations against the seats limit; re-inviting the same email needs no seat", async () => {
    const owner = await seedUser("Katherine Johnson");
    const colleague = await seedUser("Dorothy Vaughan");
    const actor = await seedWorkspace(owner.id, { id: "ws-seat-limit" });
    await addMember(actor.workspaceId, colleague.id);
    // Manual billing without a subscription: the free plan, 3 seats.
    const deps = {
      ...useCaseDeps(),
      email: null,
      billing: testBilling("manual"),
    };
    const input = (email: string) => ({
      mode: "multi" as const,
      email,
      role: "member" as const,
      appUrl,
    });

    await createInvitation(deps, actor, input("mary@example.test"));
    await createInvitation(deps, actor, input("mary@example.test"));
    await expect(
      createInvitation(deps, actor, input("christine@example.test"))
    ).rejects.toMatchObject({
      kind: "limit_reached",
      details: { metric: "seats", limit: 3, current: 3, increment: 1 },
    });
    expect(
      await rows(
        "SELECT email FROM workspace_invitations WHERE workspace_id = ? AND revoked_at IS NULL",
        actor.workspaceId
      )
    ).toEqual([{ email: "mary@example.test" }]);
  });
});
