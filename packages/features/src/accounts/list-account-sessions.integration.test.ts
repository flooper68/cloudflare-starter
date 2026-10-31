import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fixedClock, seedUser } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { listAccountSessions } from "./list-account-sessions";

describe("listAccountSessions", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const other = await seedUser("Other Person");
    const now = fixedClock().now().getTime();
    for (const [id, owner, expiry] of [
      ["current", user.id, now + 10000],
      ["expired", user.id, now - 10000],
      ["other", other.id, now + 10000],
    ] as const)
      await env.DB.prepare(
        "INSERT INTO session (id, token, user_id, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(id, `secret-${id}`, owner, now, now, expiry)
        .run();
    const result = await listAccountSessions(profileDeps(), {
      userId: user.id,
      currentSessionId: "current",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "current", current: true });
    expect(JSON.stringify(result)).not.toContain("secret-");
  });
});
