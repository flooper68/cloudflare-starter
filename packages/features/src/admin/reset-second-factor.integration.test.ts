import { describe, expect, it } from "vitest";
import {
  adminDeps,
  seedAccount,
  seedSession,
  userAudit,
} from "../../test/admin-fixtures";
import { rows } from "../../test/fixtures";
import { SelfActionError } from "./domain";
import { resetSecondFactor } from "./reset-second-factor";

describe("resetSecondFactor", () => {
  it("revokes target sessions through the gateway, audits recovery and refuses self-reset", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const target = await seedAccount("Grace Security");
    await seedSession(target.id);
    const deps = adminDeps();
    await resetSecondFactor(deps, { userId: admin.id }, { userId: target.id });
    expect(deps.gateway.calls).toContainEqual({
      op: "resetSecondFactor",
      userId: target.id,
    });
    expect(await rows("SELECT user_id FROM session")).toEqual([]);
    expect(await userAudit(target.id)).toMatchObject([
      { action: "user.second_factor_reset" },
    ]);
    await expect(
      resetSecondFactor(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
  });
});
