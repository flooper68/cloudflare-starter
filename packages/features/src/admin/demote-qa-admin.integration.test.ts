import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { demoteQaAdmin } from "./demote-qa-admin";
import { promoteBootstrapAdmin } from "./promote-bootstrap-admin";

describe("the QA admin's role", () => {
  it("promotes exactly the verified QA admin, recorded as qa.admin.promoted", async () => {
    const qa = await seedAccount("QA admin", {
      email: "qa+admin@qa.example.test",
    });
    const deps = adminDeps();
    expect(
      await promoteBootstrapAdmin(deps, {
        user: { ...qa, emailVerified: true, role: "user" },
        bootstrapAdminEmail: null,
        qaAdminEmail: "qa+admin@qa.example.test",
      })
    ).toEqual({ promoted: true });
    expect(await userAudit(qa.id)).toEqual([
      {
        action: "qa.admin.promoted",
        actorKind: "system",
        actor: null,
        metadata: { previousRole: "user" },
      },
    ]);
  });

  it.each([
    [
      "unverified",
      "qa+admin@qa.example.test",
      false,
      "qa+admin@qa.example.test",
    ],
    [
      "another QA address",
      "qa+20261108abcd-a@qa.example.test",
      true,
      "qa+admin@qa.example.test",
    ],
    [
      "qa+admin@ of another domain",
      "qa+admin@example.test",
      true,
      "qa+admin@qa.example.test",
    ],
    [
      "the bypass off (no QA admin address)",
      "qa+admin@qa.example.test",
      true,
      null,
    ],
  ])("never promotes: %s", async (_, email, emailVerified, qaAdminEmail) => {
    const account = await seedAccount("Not promoted", {
      email: `${_.replaceAll(/[^a-z]/g, "")}@seed.example.test`,
    });
    const deps = adminDeps();
    expect(
      await promoteBootstrapAdmin(deps, {
        user: { ...account, email, emailVerified, role: "user" },
        bootstrapAdminEmail: null,
        qaAdminEmail,
      })
    ).toEqual({ promoted: false });
    expect(deps.gateway.calls).toEqual([]);
  });

  it("demotes a QA admin account that is an admin, recorded as qa.admin.demoted", async () => {
    const qa = await seedAccount("QA admin two", {
      email: "qa+admin@old-qa.example.test",
      role: "admin",
    });
    const deps = adminDeps();
    expect(await demoteQaAdmin(deps, { userId: qa.id })).toEqual({
      demoted: true,
    });
    expect(deps.gateway.calls).toEqual([
      { op: "setRole", userId: qa.id, role: "user" },
    ]);
    expect((await userAudit(qa.id)).map((event) => event.action)).toEqual([
      "qa.admin.demoted",
    ]);
  });

  it("never demotes anyone else", async () => {
    const person = await seedAccount("Real admin", { role: "admin" });
    const deps = adminDeps();
    expect(await demoteQaAdmin(deps, { userId: person.id })).toEqual({
      demoted: false,
    });
    expect(await demoteQaAdmin(deps, { userId: "missing" })).toEqual({
      demoted: false,
    });
    expect(deps.gateway.calls).toEqual([]);
  });
});
