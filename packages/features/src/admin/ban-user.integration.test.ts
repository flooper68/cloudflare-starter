import { describe, expect, it } from "vitest";

import {
  adminDeps,
  NOW,
  seedAccount,
  seedSession,
  userAudit,
} from "../../test/admin-fixtures";
import { rows } from "../../test/fixtures";
import { banUser } from "./ban-user";
import {
  AdminUserNotFoundError,
  InvalidBanExpiryError,
  LastAdminError,
  SelfActionError,
} from "./domain";

describe("banUser", () => {
  it("suspends the user, signs them out everywhere and records both", async () => {
    const admin = await seedAccount("Ada Admin0", { role: "admin" });
    const grace = await seedAccount("Grace Hopper0");
    await seedSession(grace.id);
    await seedSession(grace.id);
    const deps = adminDeps();
    const until = new Date(NOW.getTime() + 7 * 24 * 3600 * 1000);

    expect(
      await banUser(
        deps,
        { userId: admin.id },
        {
          userId: grace.id,
          reason: "  Spam invitations  ",
          expiresAt: until,
        }
      )
    ).toEqual({ userId: grace.id, expiresAt: until });
    expect(deps.gateway.calls).toEqual([
      {
        op: "ban",
        userId: grace.id,
        reason: "Spam invitations",
        expiresAt: until.toISOString(),
      },
      { op: "revokeSessions", userId: grace.id },
    ]);
    expect(
      await rows("SELECT banned FROM user WHERE id = ?", grace.id)
    ).toEqual([{ banned: 1 }]);
    expect(await userAudit(grace.id)).toEqual([
      {
        action: "user.banned",
        actorKind: "admin",
        actor: admin.id,
        metadata: {
          reason: "Spam invitations",
          expiresAt: until.toISOString(),
        },
      },
      {
        action: "user.sessions_revoked",
        actorKind: "admin",
        actor: admin.id,
        metadata: { sessionCount: 2 },
      },
    ]);
  });

  it("refuses yourself, unknown users, a past expiry and the last admin", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const deps = adminDeps();
    await expect(
      banUser(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
    await expect(
      banUser(deps, { userId: admin.id }, { userId: "user-nobody" })
    ).rejects.toThrow(AdminUserNotFoundError);
    const grace = await seedAccount("Grace Hopper1");
    await expect(
      banUser(
        deps,
        { userId: admin.id },
        {
          userId: grace.id,
          expiresAt: new Date(NOW.getTime() - 1000),
        }
      )
    ).rejects.toThrow(InvalidBanExpiryError);
    expect(deps.gateway.calls).toEqual([]);
  });

  it("never suspends the last active admin", async () => {
    // A suspended admin does not count: only `other` is active, so banning them is refused.
    const banned = await seedAccount("Barbara Banned2", {
      role: "admin",
      banned: true,
    });
    const other = await seedAccount("Olga Other2", { role: "admin" });
    const deps = adminDeps();
    // Wipe other admins of earlier tests in this file.
    await rows(
      "UPDATE user SET role = 'user' WHERE role = 'admin' AND id NOT IN (?, ?)",
      banned.id,
      other.id
    );
    await expect(
      banUser(deps, { userId: banned.id }, { userId: other.id })
    ).rejects.toThrow(LastAdminError);
    expect(await userAudit(other.id)).toEqual([]);
  });
});
