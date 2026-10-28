import { describe, expect, it } from "vitest";

import {
  rows,
  seedNotification,
  seedUser,
  testApp,
  useCaseDeps,
  userAuditTrail,
} from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { deriveUnsubscribeKey, signUnsubscribeToken } from "./domain";
import { unsubscribe } from "./unsubscribe";

async function token(
  userId: string,
  type: string,
  secret: string = testApp.secret
) {
  return signUnsubscribeToken(await deriveUnsubscribeKey(secret), {
    userId,
    type,
  });
}

const deps = () => ({
  ...useCaseDeps(),
  catalog: notificationCatalog,
  secret: testApp.secret,
});

describe("unsubscribe", () => {
  it("turns email off for the token's type and records it; repeating is harmless", async () => {
    const grace = await seedUser("Grace Hopper", "grace.unsub@example.test");
    await seedNotification(grace.id, { id: "u-1", emailState: "pending" });
    await seedNotification(grace.id, {
      id: "u-2",
      emailState: "pending_digest",
    });
    await seedNotification(grace.id, {
      id: "u-3",
      type: "workspaces.role-changed",
      data: {
        workspaceId: "ws-acme",
        workspaceName: "Acme",
        role: "owner",
        previousRole: "member",
      },
      emailState: "pending",
    });
    const t = await token(grace.id, "workspaces.member-joined");

    expect(await unsubscribe(deps(), { token: t })).toEqual({
      userId: grace.id,
      types: ["workspaces.member-joined"],
    });
    await unsubscribe(deps(), { token: t });
    expect(
      await rows(
        "SELECT type, channel, enabled FROM notification_preferences WHERE user_id = ?",
        grace.id
      )
    ).toEqual([
      { type: "workspaces.member-joined", channel: "email", enabled: 0 },
    ]);
    // Mail of that type still waiting is dropped; other types are left alone.
    expect(
      await rows(
        "SELECT id, email_state FROM notifications WHERE user_id = ? ORDER BY id",
        grace.id
      )
    ).toEqual([
      { id: "u-1", email_state: "none" },
      { id: "u-2", email_state: "none" },
      { id: "u-3", email_state: "pending" },
    ]);
    expect((await userAuditTrail(grace.id))[0]).toEqual({
      action: "notifications.unsubscribed",
      actor: grace.id,
      metadata: { type: "workspaces.member-joined", channel: "email" },
    });
  });

  it("a digest's link turns off every type except security ones", async () => {
    const alan = await seedUser("Alan Turing", "alan.unsub@example.test");
    const result = await unsubscribe(deps(), {
      token: await token(alan.id, "*"),
    });
    expect(result.types).toEqual([
      "workspaces.member-joined",
      "workspaces.role-changed",
    ]);
  });

  it("refuses a tampered token or one signed with another secret", async () => {
    const ada = await seedUser("Ada Lovelace", "ada.unsub@example.test");
    const good = await token(ada.id, "workspaces.member-joined");
    for (const bad of [
      `${good}x`,
      await token(
        ada.id,
        "workspaces.member-joined",
        `${testApp.secret}-rotated`
      ),
      "",
    ]) {
      await expect(unsubscribe(deps(), { token: bad })).rejects.toMatchObject({
        name: "InvalidUnsubscribeTokenError",
      });
    }
    expect(await userAuditTrail(ada.id)).toEqual([]);
  });

  it("a deleted user's link does nothing", async () => {
    expect(
      await unsubscribe(deps(), {
        token: await token("user-gone", "workspaces.member-joined"),
      })
    ).toEqual({ userId: "user-gone", types: [] });
  });
});
