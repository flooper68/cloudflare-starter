import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { NOW, seedAccount, seedSession } from "../../test/admin-fixtures";
import { fixedClock, seedWorkspace, testDb } from "../../test/fixtures";
import { AdminUserNotFoundError } from "./domain";
import { getUserDetail } from "./get-user-detail";

const deps = () => ({ db: testDb(), clock: fixedClock(NOW.toISOString()) });
const admin = { userId: "user-admin" };

describe("getUserDetail", () => {
  it("shows profile, sign-in methods, workspaces and open sessions without tokens", async () => {
    const grace = await seedAccount("Grace Hopper", {
      verified: true,
      banned: true,
    });
    await env.DB.prepare("UPDATE user SET ban_reason = 'Spam' WHERE id = ?")
      .bind(grace.id)
      .run();
    for (const provider of ["credential", "google"]) {
      await env.DB.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0)"
      )
        .bind(`acc-${provider}`, grace.id, provider, grace.id)
        .run();
    }
    await seedWorkspace(grace.id, {
      id: "ws-grace",
      kind: "personal",
      name: "Grace",
    });
    const recent = await seedSession(grace.id, { minutesAgo: 2 });
    await seedSession(grace.id, {
      minutesAgo: 60,
      impersonatedBy: "user-admin",
    });
    await seedSession(grace.id, { expired: true });

    const detail = await getUserDetail(deps(), admin, { userId: grace.id });
    expect(detail).toMatchObject({
      id: grace.id,
      email: grace.email,
      emailVerified: true,
      role: "user",
      ban: { active: true, reason: "Spam", expiresAt: null },
      signInMethods: ["credential", "google"],
      lastSeenAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      workspaces: [
        { id: "ws-grace", name: "Grace", kind: "personal", role: "owner" },
      ],
    });
    expect(detail.sessions.map((s) => [s.id, s.impersonatedBy])).toEqual([
      [recent, null],
      [expect.any(String), "user-admin"],
    ]);
    expect(JSON.stringify(detail)).not.toContain("token-");
  });

  it("not found for an unknown user", async () => {
    await expect(
      getUserDetail(deps(), admin, { userId: "user-nobody" })
    ).rejects.toThrow(AdminUserNotFoundError);
  });
});
