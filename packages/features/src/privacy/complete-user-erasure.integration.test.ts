import { describe, expect, it } from "vitest";
import { rows } from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { completeUserErasure } from "./complete-user-erasure";
import { erasureLock, erasureRecords } from "./privacy.schema";

describe("completeUserErasure", () => {
  it("keeps only id/timestamps and records completion once without an IP", async () => {
    const { deps, person } = await privacyFixture();
    await deps.db
      .insert(erasureRecords)
      .values({ userId: person.id, requestedAt: deps.clock.now() });
    await deps.db.insert(erasureLock).values({
      id: "global",
      userId: person.id,
      operationId: "test-operation",
      leaseUntil: new Date(deps.clock.now().getTime() + 1200000),
    });
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "test-operation",
    });
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "test-operation",
    });
    expect(
      await rows(
        "SELECT action,ip FROM audit_events WHERE action='privacy.user_erased'"
      )
    ).toEqual([{ action: "privacy.user_erased", ip: null }]);
    expect(await rows("SELECT * FROM erasure_records")).toEqual([
      {
        user_id: person.id,
        requested_at: deps.clock.now().getTime(),
        completed_at: deps.clock.now().getTime(),
      },
    ]);
  });
});
