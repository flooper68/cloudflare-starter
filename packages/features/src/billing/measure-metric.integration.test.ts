import { describe, expect, it } from "vitest";

import {
  billingDeps,
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "../files";
import { measureMetric } from "./measure-metric";
import { recordUsage } from "./record-usage";

describe("measureMetric", () => {
  it("measures each kind of metric for one workspace only", async () => {
    const owner = await seedUser();
    const other = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-measure" });
    const elsewhere = await seedWorkspace(other.id, { id: "ws-elsewhere" });
    const files = {
      db: testDb(),
      clock: fixedClock(),
      ids: sequentialIds(),
      billing: testBilling(),
    };
    for (const [who, size] of [
      [actor, 1500],
      [actor, 2500],
      [elsewhere, 999],
    ] as const) {
      await createFileRecord(files, who, {
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: size,
      });
    }
    await invite(actor, "grace@example.test");
    await recordUsage(
      billingDeps(),
      actor.workspaceId,
      "files.uploads_per_month",
      4
    );

    const deps = billingDeps();
    expect(await measureMetric(deps, actor.workspaceId, "storage_bytes")).toBe(
      4000
    );
    expect(await measureMetric(deps, actor.workspaceId, "seats")).toBe(2);
    expect(
      await measureMetric(deps, actor.workspaceId, "files.uploads_per_month")
    ).toBe(4);
    expect(await measureMetric(deps, "ws-empty", "storage_bytes")).toBe(0);
  });
});
