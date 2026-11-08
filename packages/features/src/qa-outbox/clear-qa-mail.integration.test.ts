import { describe, expect, it } from "vitest";

import { fixedClock, testDb } from "../../test/fixtures";
import { message, OWNER, storeAt } from "../../test/qa-outbox-fixtures";
import { clearQaMail } from "./clear-qa-mail";
import { listQaMail } from "./list-qa-mail";

const NOW = "2026-11-08T12:00:00.000Z";
const OTHER = "qa+20261108kqzt-other@qa.flooper.me";

describe("clearQaMail", () => {
  it("deletes one recipient's mail and nobody else's", async () => {
    await storeAt(NOW, message(OWNER));
    await storeAt(NOW, message(OWNER, "Second"));
    await storeAt(NOW, message(OTHER));
    expect(await clearQaMail({ db: testDb() }, { to: OWNER })).toEqual({
      deleted: 2,
    });
    const deps = { db: testDb(), clock: fixedClock(NOW) };
    expect(
      await listQaMail(deps, { to: OWNER, since: null, subject: null })
    ).toEqual([]);
    expect(
      await listQaMail(deps, { to: OTHER, since: null, subject: null })
    ).toHaveLength(1);
  });
});
