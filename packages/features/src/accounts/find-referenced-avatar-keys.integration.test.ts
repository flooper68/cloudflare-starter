import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { findReferencedAvatarKeys } from "./find-referenced-avatar-keys";
import { userSettings } from "./user-settings.schema";

describe("findReferencedAvatarKeys", () => {
  it("uses the avatar reference index for a reconciliation batch", async () => {
    const plan = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT avatar_key FROM user_settings WHERE avatar_key IN (?, ?)"
    )
      .bind("users/one/avatar/current", "users/two/avatar/current")
      .all<{ detail: string }>();
    expect(plan.results.map((row) => row.detail).join(" ")).toContain(
      "USING COVERING INDEX user_settings_avatar_key_idx"
    );
  });
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const deps = profileDeps();
    const key = `users/${user.id}/avatar/current`;
    await deps.db
      .insert(userSettings)
      .values({ userId: user.id, avatarKey: key });
    expect(await findReferencedAvatarKeys(deps, [])).toEqual(new Set());
    expect(
      await findReferencedAvatarKeys(deps, [
        ...Array.from({ length: 60 }, (_, i) => `old-${i}`),
        key,
      ])
    ).toEqual(new Set([key]));
  });
});
