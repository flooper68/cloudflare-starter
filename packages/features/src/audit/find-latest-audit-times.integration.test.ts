import { describe, expect, it } from "vitest";

import { sequentialIds, testDb, testRequestContext } from "../../test/fixtures";
import { findLatestAuditTimes } from "./find-latest-audit-times";
import { recordAuditEvent } from "./record-audit-event";

let run = 0;
async function warned(userId: string, iso: string) {
  run += 1;
  await recordAuditEvent(
    {
      db: testDb(),
      clock: { now: () => new Date(iso) },
      ids: sequentialIds(`${String(run).padStart(8, "0")}-6666-4000-8000-`),
    },
    testRequestContext(),
    {
      action: "demo.deletion_warned",
      actor: { kind: "system" },
      target: { type: "user", id: userId },
      metadata: { deletesAt: iso },
    }
  );
}

describe("findLatestAuditTimes", () => {
  it("returns the latest time of the action per target, for targets it happened to", async () => {
    await warned("user-a", "2026-11-01T00:00:00.000Z");
    await warned("user-a", "2026-11-05T00:00:00.000Z");
    await warned("user-b", "2026-11-03T00:00:00.000Z");
    const ids = ["user-a", "user-b", "user-c"];
    // More ids than one statement takes, to cover the chunking.
    for (let i = 0; i < 120; i++) ids.push(`user-pad-${i}`);

    const found = await findLatestAuditTimes(
      { db: testDb() },
      { action: "demo.deletion_warned", targetType: "user", targetIds: ids }
    );
    expect(Object.fromEntries(found)).toEqual({
      "user-a": new Date("2026-11-05T00:00:00.000Z"),
      "user-b": new Date("2026-11-03T00:00:00.000Z"),
    });
    expect(
      await findLatestAuditTimes(
        { db: testDb() },
        { action: "demo.account_erased", targetType: "user", targetIds: ids }
      )
    ).toEqual(new Map());
  });
});
