import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { promoteBootstrapAdmin } from "./promote-bootstrap-admin";

describe("promoteBootstrapAdmin", () => {
  it("makes the verified bootstrap account an admin, recorded as the system", async () => {
    const founder = await seedAccount("Fay Founder", {
      email: "Founder@Acme.test",
    });
    const deps = adminDeps();
    expect(
      await promoteBootstrapAdmin(deps, {
        user: { ...founder, emailVerified: true, role: "user" },
        bootstrapAdminEmail: "founder@acme.test",
      })
    ).toEqual({ promoted: true });
    expect(deps.gateway.calls).toEqual([
      { op: "setRole", userId: founder.id, role: "admin" },
    ]);
    expect(await userAudit(founder.id)).toEqual([
      {
        action: "user.role_changed",
        actorKind: "system",
        actor: null,
        metadata: { previousRole: "user", role: "admin" },
      },
    ]);
  });

  it.each([
    {
      label: "unverified",
      emailVerified: false,
      role: "user",
      email: "founder@acme.test",
      setting: "founder@acme.test",
    },
    {
      label: "another address",
      emailVerified: true,
      role: "user",
      email: "grace@acme.test",
      setting: "founder@acme.test",
    },
    {
      label: "already admin",
      emailVerified: true,
      role: "admin",
      email: "founder@acme.test",
      setting: "founder@acme.test",
    },
    {
      label: "no bootstrap setting",
      emailVerified: true,
      role: "user",
      email: "founder@acme.test",
      setting: null,
    },
  ])(
    "does nothing: $label",
    async ({ emailVerified, role, email, setting }) => {
      const deps = adminDeps();
      expect(
        await promoteBootstrapAdmin(deps, {
          user: { id: "user-x", email, emailVerified, role },
          bootstrapAdminEmail: setting,
        })
      ).toEqual({ promoted: false });
      expect(deps.gateway.calls).toEqual([]);
    }
  );
});
