import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { rows } from "../../test/fixtures";
import { SelfActionError } from "./domain";
import { unbanUser } from "./unban-user";

describe("unbanUser", () => {
  it("lifts a suspension and records it", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper", { banned: true });
    const deps = adminDeps();

    expect(
      await unbanUser(deps, { userId: admin.id }, { userId: grace.id })
    ).toEqual({ userId: grace.id, changed: true });
    expect(
      await rows("SELECT banned FROM user WHERE id = ?", grace.id)
    ).toEqual([{ banned: 0 }]);
    expect((await userAudit(grace.id)).map((event) => event.action)).toEqual([
      "user.unbanned",
    ]);
  });

  it("does nothing for a user who is not suspended, and refuses yourself", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const alan = await seedAccount("Alan Turing1");
    const deps = adminDeps();
    expect(
      await unbanUser(deps, { userId: admin.id }, { userId: alan.id })
    ).toEqual({ userId: alan.id, changed: false });
    expect(deps.gateway.calls).toEqual([]);
    expect(await userAudit(alan.id)).toEqual([]);
    await expect(
      unbanUser(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
  });
});
