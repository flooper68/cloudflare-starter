import { describe, expect, it } from "vitest";

import {
  adminDeps,
  seedAccount,
  seedSession,
  userAudit,
} from "../../test/admin-fixtures";
import { rows } from "../../test/fixtures";
import { SelfActionError } from "./domain";
import { revokeUserSessions } from "./revoke-user-sessions";

describe("revokeUserSessions", () => {
  it("signs the user out everywhere and records how many sessions ended", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper");
    await seedSession(grace.id);
    await seedSession(grace.id, { minutesAgo: 600 });
    await seedSession(admin.id);
    const deps = adminDeps();

    expect(
      await revokeUserSessions(deps, { userId: admin.id }, { userId: grace.id })
    ).toEqual({ userId: grace.id, sessionCount: 2 });
    expect(await rows("SELECT user_id FROM session ORDER BY user_id")).toEqual([
      { user_id: admin.id },
    ]);
    expect(await userAudit(grace.id)).toMatchObject([
      {
        action: "user.sessions_revoked",
        actor: admin.id,
        metadata: { sessionCount: 2 },
      },
    ]);
    await expect(
      revokeUserSessions(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
  });
});
