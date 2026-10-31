import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { listDataRequests } from "./list-data-requests";
import { requestDataExport } from "./request-data-export";

describe("listDataRequests", () => {
  it("does not list other users' requests or internal object keys", async () => {
    const a = await privacyFixture();
    const b = await privacyFixture();
    await requestDataExport(a.deps, a.person.id);
    await requestDataExport(b.deps, b.person.id);
    const rows = await listDataRequests(a.deps, a.person.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectId).toBe(a.person.id);
    expect(rows[0]).not.toHaveProperty("objectKey");
    expect(rows[0]).not.toHaveProperty("uploadId");
  });
});
