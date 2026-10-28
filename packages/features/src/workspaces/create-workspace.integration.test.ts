import { describe, expect, it } from "vitest";

import {
  auditTrail,
  rows,
  seedUser,
  sequentialIds,
  useCaseDeps,
} from "../../test/fixtures";
import { createWorkspace } from "./create-workspace";

describe("createWorkspace", () => {
  it("multi mode: creates a shared workspace owned by the user and makes it active", async () => {
    const ada = await seedUser("Ada Lovelace");
    const deps = { ...useCaseDeps(), ids: sequentialIds() };
    expect(
      await createWorkspace(deps, {
        userId: ada.id,
        mode: "multi",
        name: "  Acme Robotics ",
      })
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Acme Robotics",
      kind: "shared",
      role: "owner",
    });
    expect(await auditTrail("00000000-0000-4000-8000-000000000001")).toEqual([
      expect.objectContaining({
        action: "workspace.created",
        metadata: { kind: "shared" },
      }),
    ]);
    expect(
      await rows(
        "SELECT role, last_active_at FROM workspace_members WHERE user_id = ?",
        ada.id
      )
    ).toEqual([
      { role: "owner", last_active_at: Date.parse("2026-10-28T12:00:00Z") },
    ]);
  });

  it("is refused outside multi mode and for blank names", async () => {
    const ken = await seedUser("Ken Thompson");
    const deps = useCaseDeps();
    for (const mode of ["personal", "single"] as const) {
      await expect(
        createWorkspace(deps, { userId: ken.id, mode, name: "Acme" })
      ).rejects.toMatchObject({ name: "WorkspaceModeError" });
    }
    await expect(
      createWorkspace(deps, { userId: ken.id, mode: "multi", name: "   " })
    ).rejects.toThrow();
  });
});
