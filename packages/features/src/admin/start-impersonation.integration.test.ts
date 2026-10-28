import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { CannotImpersonateError, SelfActionError } from "./domain";
import { startImpersonation } from "./start-impersonation";

describe("startImpersonation", () => {
  it("swaps the session through the gateway and records it", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper");
    const deps = adminDeps();
    expect(
      await startImpersonation(deps, { userId: admin.id }, { userId: grace.id })
    ).toEqual({ userId: grace.id });
    expect(deps.gateway.calls).toEqual([
      { op: "startImpersonation", userId: grace.id },
    ]);
    expect(await userAudit(grace.id)).toMatchObject([
      { action: "impersonation.started", actorKind: "admin", actor: admin.id },
    ]);
  });

  it("refuses admins, suspended users and yourself", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const other = await seedAccount("Olga Admin1", { role: "admin" });
    const banned = await seedAccount("Barbara Banned1", { banned: true });
    const deps = adminDeps();
    for (const userId of [other.id, banned.id]) {
      await expect(
        startImpersonation(deps, { userId: admin.id }, { userId })
      ).rejects.toThrow(CannotImpersonateError);
    }
    await expect(
      startImpersonation(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
    expect(deps.gateway.calls).toEqual([]);
  });
});
