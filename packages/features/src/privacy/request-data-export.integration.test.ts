import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { dataRequests } from "./privacy.schema";
import { requestDataExport } from "./request-data-export";

describe("requestDataExport", () => {
  it("atomically allows only one concurrent active request", async () => {
    const { deps, person } = await privacyFixture();
    const results = await Promise.allSettled([
      requestDataExport(deps, person.id),
      requestDataExport(deps, person.id),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(deps.jobQueue.sent).toHaveLength(1);
  });
  it("refuses the fourth request in a rolling day even after earlier requests finish", async () => {
    const { deps, person } = await privacyFixture();
    for (let i = 0; i < 3; i++) {
      const r = await requestDataExport(deps, person.id);
      await deps.db
        .update(dataRequests)
        .set({ status: "failed" })
        .where(eq(dataRequests.id, r.id));
    }
    await expect(requestDataExport(deps, person.id)).rejects.toMatchObject({
      code: "EXPORT_LIMIT",
    });
  });
  it("queue failure removes admission row for a retry", async () => {
    const { deps, person } = await privacyFixture();
    await expect(
      requestDataExport(
        {
          ...deps,
          jobQueue: {
            send: async () => {
              throw new Error("queue offline");
            },
          },
        },
        person.id
      )
    ).rejects.toThrow("queue offline");
    expect(
      await deps.db
        .select()
        .from(dataRequests)
        .where(eq(dataRequests.userId, person.id))
    ).toHaveLength(0);
  });
  it("refuses new exports while the subject is being erased", async () => {
    const { deps, person } = await privacyFixture();
    await deps.db.run(
      sql`INSERT INTO privacy_erasure_lock(id,user_id,operation_id,lease_until) VALUES ('global',${person.id},'test-operation',${deps.clock.now().getTime() + 60000})`
    );
    await expect(requestDataExport(deps, person.id)).rejects.toMatchObject({
      code: "EXPORT_UNAVAILABLE",
    });
    expect(deps.jobQueue.sent).toHaveLength(0);
  });
});
