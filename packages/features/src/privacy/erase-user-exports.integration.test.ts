import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildDataExport } from "./build-data-export";
import { eraseUserExports } from "./erase-user-exports";
import { listDataRequests } from "./list-data-requests";
import { requestDataExport } from "./request-data-export";

describe("eraseUserExports", () => {
  it("removes prior archives and request metadata for only the erased user", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    await buildDataExport(deps, { requestId: r.id, attempts: 1 });
    const before = await deps.bucket.list({ prefix: `exports/${r.id}/` });
    expect(before.objects).toHaveLength(1);
    await eraseUserExports(deps, { userId: person.id });
    expect(
      (await deps.bucket.list({ prefix: `exports/${r.id}/` })).objects
    ).toHaveLength(0);
    expect(await listDataRequests(deps, person.id)).toEqual([]);
  });
});
