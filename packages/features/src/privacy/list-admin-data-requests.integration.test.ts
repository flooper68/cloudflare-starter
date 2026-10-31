import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { listAdminDataRequests } from "./list-admin-data-requests";
import { requestDataExport } from "./request-data-export";

describe("listAdminDataRequests", () => {
  it("lists request metadata without archive credentials", async () => {
    const { deps, person } = await privacyFixture();
    await requestDataExport(deps, person.id);
    const page = await listAdminDataRequests(deps, { userId: "admin" });
    expect(page.exports).toHaveLength(1);
    expect(page.exports[0]).not.toHaveProperty("objectKey");
    expect(page.exports[0]).not.toHaveProperty("uploadId");
  });
});
