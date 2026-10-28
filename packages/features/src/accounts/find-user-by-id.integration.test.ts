import { describe, expect, it } from "vitest";

import { seedUser, testDb } from "../../test/fixtures";
import { findUserById } from "./find-user-by-id";

describe("findUserById", () => {
  it("returns the user's id, email and name, or null", async () => {
    const user = await seedUser();
    expect(await findUserById({ db: testDb() }, user.id)).toEqual(user);
    expect(await findUserById({ db: testDb() }, "nobody")).toBeNull();
  });
});
