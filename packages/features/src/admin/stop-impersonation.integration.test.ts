import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { NotImpersonatingError } from "./domain";
import { stopImpersonation } from "./stop-impersonation";

describe("stopImpersonation", () => {
  it("restores the admin's session and records it with the admin as actor", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper");
    const deps = adminDeps();
    expect(
      await stopImpersonation(deps, {
        userId: grace.id,
        impersonatedBy: admin.id,
      })
    ).toEqual({ adminUserId: admin.id });
    expect(deps.gateway.calls).toEqual([{ op: "stopImpersonation" }]);
    expect(await userAudit(grace.id)).toMatchObject([
      { action: "impersonation.stopped", actorKind: "admin", actor: admin.id },
    ]);
  });

  it("refuses a session that is not an impersonation", async () => {
    const grace = await seedAccount("Grace Hopper1");
    const deps = adminDeps();
    await expect(
      stopImpersonation(deps, { userId: grace.id, impersonatedBy: null })
    ).rejects.toThrow(NotImpersonatingError);
    expect(deps.gateway.calls).toEqual([]);
  });
});
