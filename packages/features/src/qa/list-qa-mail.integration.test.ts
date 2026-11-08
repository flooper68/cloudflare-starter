import { describe, expect, it } from "vitest";

import { fixedClock, testDb } from "../../test/fixtures";
import { message, OWNER, storeAt } from "../../test/qa-fixtures";
import { listQaMail } from "./list-qa-mail";

const NOW = "2026-11-08T12:00:00.000Z";
const list = (input: {
  readonly since?: string;
  readonly subject?: string;
  readonly to?: string;
}) =>
  listQaMail(
    { db: testDb(), clock: fixedClock(NOW) },
    {
      to: input.to ?? OWNER,
      since: input.since ? new Date(input.since) : null,
      subject: input.subject ?? null,
    }
  );

describe("listQaMail", () => {
  it("filters by recipient, since and subject, newest first, within 24 hours", async () => {
    await storeAt("2026-11-07T11:59:59.000Z", message(OWNER, "Too old"));
    await storeAt(
      "2026-11-08T10:00:00.000Z",
      message(OWNER, "Verify your email")
    );
    await storeAt(
      "2026-11-08T11:00:00.000Z",
      message(OWNER, "Reset your password")
    );
    await storeAt(
      "2026-11-08T11:30:00.000Z",
      message(OWNER, "Verify your email")
    );
    await storeAt(
      "2026-11-08T11:45:00.000Z",
      message("qa+20261108kqzt-other@qa.flooper.me", "Verify your email")
    );

    expect((await list({})).map((mail) => mail.subject)).toEqual([
      "Verify your email",
      "Reset your password",
      "Verify your email",
    ]);
    expect(
      (await list({ subject: "VERIFY" })).map((m) => m.receivedAt)
    ).toEqual(["2026-11-08T11:30:00.000Z", "2026-11-08T10:00:00.000Z"]);
    expect(await list({ since: "2026-11-08T11:00:00.000Z" })).toHaveLength(2);
    expect(await list({ since: "2020-01-01T00:00:00.000Z" })).toHaveLength(3);
    expect(await list({ to: "qa+20261108kqzt-nobody@qa.flooper.me" })).toEqual(
      []
    );
  });
});
