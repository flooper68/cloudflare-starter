import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { UnknownCatalogKeyError } from "./domain";
import { setOverride } from "./set-override";

describe("setOverride", () => {
  it("sets, replaces and removes an override, auditing each with its reason", async () => {
    const owner = await seedUser();
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-overrides" });
    const deps = billingDeps();
    const set = (override: Parameters<typeof setOverride>[2]["override"]) =>
      setOverride(
        deps,
        { userId: admin.id },
        {
          workspaceId: actor.workspaceId,
          key: "seats",
          override,
          reason: "Conference booth team",
        }
      );

    await set({ kind: "limit", limit: 12 });
    await set({ kind: "limit", limit: null });
    expect(
      await rows(
        "SELECT key, kind, enabled, limit_value, reason, created_by FROM entitlement_override WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([
      {
        key: "seats",
        kind: "limit",
        enabled: null,
        limit_value: null,
        reason: "Conference booth team",
        created_by: admin.id,
      },
    ]);
    await set(null);
    expect(
      await rows(
        "SELECT * FROM entitlement_override WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([]);
    expect(
      (await auditTrail(actor.workspaceId)).map((event) => event.metadata)
    ).toEqual([
      {
        key: "seats",
        kind: "limit",
        limit: 12,
        reason: "Conference booth team",
      },
      {
        key: "seats",
        kind: "limit",
        limit: null,
        reason: "Conference booth team",
      },
      { key: "seats", kind: "removed", reason: "Conference booth team" },
    ]);
  });

  it("refuses a key that is not a feature or metric of the catalog", async () => {
    const owner = await seedUser("Ada Lovelace");
    const admin = await seedUser("Barbara Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-overrides-bad" });
    await expect(
      setOverride(
        billingDeps(),
        { userId: admin.id },
        {
          workspaceId: actor.workspaceId,
          key: "seats",
          override: { kind: "feature", enabled: true },
          reason: "Wrong kind",
        }
      )
    ).rejects.toBeInstanceOf(UnknownCatalogKeyError);
  });
});
