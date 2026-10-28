import { describe, expect, it } from "vitest";

import {
  fixedClock,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { listAuditEvents } from "./list-audit-events";
import { purgeAuditEvents } from "./purge-audit-events";
import { recordAuditEvent } from "./record-audit-event";

const NOW = "2026-10-28T12:00:00.000Z";
// AUDIT_RETENTION_DAYS (400) before NOW.
const CUTOFF = "2025-09-23T12:00:00.000Z";

describe("purgeAuditEvents", () => {
  it("deletes events older than the retention period and keeps the rest", async () => {
    const ids = sequentialIds();
    const recordAt = (at: string) =>
      recordAuditEvent(
        { db: testDb(), clock: fixedClock(at), ids },
        testRequestContext(),
        { action: "user.deleted", target: { type: "user", id: `user-${at}` } }
      );
    await recordAt("2025-01-01T00:00:00.000Z");
    await recordAt("2025-09-23T11:59:59.999Z"); // a millisecond past retention
    await recordAt(CUTOFF); // exactly at the boundary: kept
    await recordAt("2026-10-27T12:00:00.000Z");

    const result = await purgeAuditEvents({
      db: testDb(),
      clock: fixedClock(NOW),
    });

    expect(result).toEqual({ deleted: 2, cutoff: CUTOFF });
    const left = await listAuditEvents({ db: testDb() });
    expect(left.events.map((event) => event.occurredAt)).toEqual([
      "2026-10-27T12:00:00.000Z",
      CUTOFF,
    ]);
  });

  it("deletes in batches until nothing past retention is left", async () => {
    const ids = sequentialIds("10000000-0000-4000-8000-");
    const old = fixedClock("2010-01-01T00:00:00.000Z");
    for (let index = 0; index < 1_100; index += 100) {
      await Promise.all(
        Array.from({ length: 100 }, () =>
          recordAuditEvent(
            { db: testDb(), clock: old, ids },
            testRequestContext(),
            { action: "user.unbanned", target: { type: "user", id: "u" } }
          )
        )
      );
    }

    const result = await purgeAuditEvents(
      { db: testDb(), clock: fixedClock(NOW) },
      { retentionDays: 3_000 } // cutoff in 2018: only the 2010 events
    );

    expect(result.deleted).toBe(1_100);
    const left = await listAuditEvents(
      { db: testDb() },
      { action: "user.unbanned" }
    );
    expect(left.events).toEqual([]);
  });
});
