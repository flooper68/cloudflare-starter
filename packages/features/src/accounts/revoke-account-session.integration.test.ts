import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { rows, seedUser } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { revokeAccountSession } from "./revoke-account-session";

describe("revokeAccountSession", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const other = await seedUser("Other Person");
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO session (id, token, user_id, created_at, updated_at, expires_at) VALUES ('own', 'secret-token', ?, ?, ?, ?)"
    )
      .bind(user.id, now, now, now + 10000)
      .run();
    const tokens: string[] = [];
    const deps = {
      ...profileDeps(),
      gateway: {
        revokeSession: async (token: string) => {
          tokens.push(token);
        },
      },
    };
    await expect(
      revokeAccountSession(deps, { userId: other.id, sessionId: "own" })
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
    expect(tokens).toEqual([]);
    expect(
      await revokeAccountSession(deps, { userId: user.id, sessionId: "own" })
    ).toEqual({ revoked: true });
    expect(tokens).toEqual(["secret-token"]);
    expect(
      JSON.stringify(await rows("SELECT metadata FROM audit_events"))
    ).not.toContain("secret-token");
  });
});
