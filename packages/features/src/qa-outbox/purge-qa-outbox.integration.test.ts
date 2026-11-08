import { describe, expect, it } from "vitest";

import { fixedClock, testDb } from "../../test/fixtures";
import { message, OWNER, storeAt } from "../../test/qa-outbox-fixtures";
import { listQaMail } from "./list-qa-mail";
import { purgeQaOutbox } from "./purge-qa-outbox";

describe("purgeQaOutbox", () => {
  it("deletes mail older than 24 hours and keeps the rest", async () => {
    await storeAt("2026-11-07T11:59:59.999Z", message(OWNER, "Old"));
    await storeAt("2026-11-07T12:00:00.000Z", message(OWNER, "Boundary"));
    await storeAt("2026-11-08T11:00:00.000Z", message(OWNER, "New"));
    const deps = {
      db: testDb(),
      clock: fixedClock("2026-11-08T12:00:00.000Z"),
    };
    expect(await purgeQaOutbox(deps)).toEqual({ deleted: 1 });
    expect(
      (
        await listQaMail(
          { ...deps, clock: fixedClock("2026-11-07T12:00:00.000Z") },
          { to: OWNER, since: null, subject: null }
        )
      ).map((mail) => mail.subject)
    ).toEqual(["New", "Boundary"]);
  });
});
