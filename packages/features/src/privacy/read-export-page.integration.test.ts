import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { DATA_CATALOG } from "../data-catalog";
import { readExportPage } from "./read-export-page";

describe("readExportPage", () => {
  it("exports only the subject profile and whitelisted columns", async () => {
    const { deps, person } = await privacyFixture();
    await seedUser("Other export", "other-export@example.test");
    const entity = DATA_CATALOG.find((x) => x.table === "user");
    expect(entity).toBeDefined();
    if (!entity) throw new Error("missing entity");
    const rows = await readExportPage(
      deps,
      entity,
      { userId: person.id, scope: "user", workspaceId: null },
      0
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(person.email);
    expect(Object.keys(rows[0] ?? {})).not.toContain("password");
    expect(
      await readExportPage(
        deps,
        entity,
        { userId: person.id, scope: "user", workspaceId: null },
        Number(rows[0]?._rowid)
      )
    ).toEqual([]);
  });
});
