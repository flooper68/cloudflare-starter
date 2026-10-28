import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { UnknownCatalogKeyError } from "./domain";
import { setAddons } from "./set-addons";

describe("setAddons", () => {
  it("replaces the add-ons and audits the new list", async () => {
    const owner = await seedUser();
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-addons" });
    const deps = billingDeps();
    await setAddons(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        addons: [
          { addonId: "extra_seats", quantity: 2 },
          { addonId: "extra_storage", quantity: 1 },
        ],
      }
    );
    await setAddons(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        addons: [{ addonId: "direct_uploads", quantity: 1 }],
      }
    );
    expect(
      await rows(
        "SELECT addon_id, quantity FROM workspace_addon WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([{ addon_id: "direct_uploads", quantity: 1 }]);
    expect((await auditTrail(actor.workspaceId)).at(-1)).toEqual({
      action: "billing.addons_set",
      actor: admin.id,
      target: `workspace:${actor.workspaceId}`,
      metadata: { addons: [{ addonId: "direct_uploads", quantity: 1 }] },
    });
  });

  it("refuses an add-on the catalog does not have", async () => {
    const owner = await seedUser("Ada Lovelace");
    const admin = await seedUser("Barbara Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-addons-bad" });
    await expect(
      setAddons(
        billingDeps(),
        { userId: admin.id },
        {
          workspaceId: actor.workspaceId,
          addons: [{ addonId: "gold_support", quantity: 1 }],
        }
      )
    ).rejects.toBeInstanceOf(UnknownCatalogKeyError);
  });
});
