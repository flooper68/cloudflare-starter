import { describe, expect, it } from "vitest";

import { sequentialIds, testDb, testRequestContext } from "../../test/fixtures";
import { countAuditEvents } from "./count-audit-events";
import { recordAuditEvent } from "./record-audit-event";

let run = 0;
async function erased(iso: string) {
  run += 1;
  await recordAuditEvent(
    {
      db: testDb(),
      clock: { now: () => new Date(iso) },
      ids: sequentialIds(`${String(run).padStart(8, "0")}-7777-4000-8000-`),
    },
    testRequestContext(),
    {
      action: "demo.account_erased",
      actor: { kind: "system" },
      target: { type: "user", id: `user-${run}` },
      metadata: { retentionDays: 7 },
    }
  );
}

describe("countAuditEvents", () => {
  it("counts one action from a time on", async () => {
    await erased("2026-11-01T00:00:00.000Z");
    await erased("2026-11-05T00:00:00.000Z");
    await erased("2026-11-06T00:00:00.000Z");
    const deps = { db: testDb() };
    expect(
      await countAuditEvents(deps, {
        action: "demo.account_erased",
        since: new Date("2026-11-05T00:00:00.000Z"),
      })
    ).toBe(2);
    expect(
      await countAuditEvents(deps, {
        action: "user.deleted",
        since: new Date("2026-01-01T00:00:00.000Z"),
      })
    ).toBe(0);
  });
});
