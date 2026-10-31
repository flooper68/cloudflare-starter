import { describe, expect, it } from "vitest";
import { addMember, seedUser, seedWorkspace } from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { authorizeExport } from "./authorize-export";

describe("authorizeExport", () => {
  it("requires current workspace ownership, not membership or another workspace", async () => {
    const { deps, person } = await privacyFixture();
    const other = await seedUser("Export owner", "export-owner@example.test");
    const owner = await seedWorkspace(other.id);
    await addMember(owner.workspaceId, person.id);
    await expect(
      authorizeExport(deps, {
        userId: person.id,
        scope: "workspace",
        workspaceId: owner.workspaceId,
      })
    ).rejects.toMatchObject({ kind: "forbidden" });
    await expect(
      authorizeExport(deps, {
        userId: other.id,
        scope: "workspace",
        workspaceId: owner.workspaceId,
      })
    ).resolves.toBeUndefined();
    await expect(
      authorizeExport(deps, {
        userId: "missing",
        scope: "user",
        workspaceId: null,
      })
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
  });
});
