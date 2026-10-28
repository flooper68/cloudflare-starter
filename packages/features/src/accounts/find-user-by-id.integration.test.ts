import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { fixedClock, seedUser, testDb } from "../../test/fixtures";
import { findUserById } from "./find-user-by-id";

const deps = () => ({ db: testDb(), clock: fixedClock() });

describe("findUserById", () => {
  it("returns the user's id, email and name, or null", async () => {
    const user = await seedUser();
    expect(await findUserById(deps(), user.id)).toEqual(user);
    expect(await findUserById(deps(), "nobody")).toBeNull();
  });

  it("treats a suspended user as no user until the suspension ends", async () => {
    const user = await seedUser("Sam Suspended");
    const suspend = (expires: string | null) =>
      env.DB.prepare("UPDATE user SET banned = 1, ban_expires = ? WHERE id = ?")
        .bind(expires ? new Date(expires).getTime() : null, user.id)
        .run();
    await suspend(null);
    expect(await findUserById(deps(), user.id)).toBeNull();
    await suspend("2026-11-01T00:00:00.000Z");
    expect(await findUserById(deps(), user.id)).toBeNull();
    await suspend("2026-10-01T00:00:00.000Z");
    expect(await findUserById(deps(), user.id)).toEqual(user);
  });
});
