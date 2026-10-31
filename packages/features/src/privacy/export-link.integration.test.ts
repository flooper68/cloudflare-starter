import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildDataExport } from "./build-data-export";
import { createExportLink } from "./export-link";
import { requestDataExport } from "./request-data-export";

describe("createExportLink", () => {
  it("only supplies a completed unexpired owner's export", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    const signed = { ...deps, secret: "private-export-test-secret-00000000" };
    await expect(
      createExportLink(signed, person.id, { requestId: r.id })
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
    await buildDataExport(deps, { requestId: r.id, attempts: 1 });
    expect(
      (await createExportLink(signed, person.id, { requestId: r.id })).href
    ).toContain("signature=");
    await expect(
      createExportLink(signed, "outsider", { requestId: r.id })
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
  });
});
