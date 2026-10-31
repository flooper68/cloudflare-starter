import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildDataExport } from "./build-data-export";
import { downloadDataExport } from "./download-data-export";
import { createExportLink } from "./export-link";
import { requestDataExport } from "./request-data-export";

describe("downloadDataExport", () => {
  it("rejects cross-user, expired and tampered links and streams a valid archive", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    await buildDataExport(deps, { requestId: r.id, attempts: 1 });
    const signed = { ...deps, secret: "private-export-test-secret-00000000" };
    const url = new URL(
      (await createExportLink(signed, person.id, { requestId: r.id })).href,
      "https://app.example"
    );
    const input = {
      requestId: r.id,
      expires: Number(url.searchParams.get("expires")),
      signature: url.searchParams.get("signature") ?? "",
    };
    const download = await downloadDataExport(signed, person.id, input);
    const first = await download.body.getReader().read();
    expect(Array.from(first.value?.slice(0, 2) ?? [])).toEqual([80, 75]);
    await expect(
      downloadDataExport(signed, "other", input)
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
    await expect(
      downloadDataExport(signed, person.id, {
        ...input,
        signature: "f".repeat(64),
      })
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
    await expect(
      downloadDataExport(
        { ...signed, clock: { now: () => new Date(input.expires) } },
        person.id,
        input
      )
    ).rejects.toMatchObject({ code: "EXPORT_UNAVAILABLE" });
  });
});
