import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildDataExport } from "./build-data-export";
import { dataRequests } from "./privacy.schema";
import { purgeDataExports } from "./purge-data-exports";
import { requestDataExport } from "./request-data-export";

describe("purgeDataExports", () => {
  it("invalidates and deletes the archive after 24 hours", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    await buildDataExport(deps, { requestId: r.id, attempts: 1 });
    const [before] = await deps.db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, r.id));
    await purgeDataExports(deps, {
      asOf: new Date(deps.clock.now().getTime() + 86400000).toISOString(),
    });
    expect(await deps.bucket.head(before?.objectKey ?? "missing")).toBeNull();
    const [after] = await deps.db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, r.id));
    expect(after).toMatchObject({ status: "expired", objectKey: null });
  });
});
