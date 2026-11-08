import { describe, expect, it } from "vitest";

import { fixedClock, sequentialIds, testDb } from "../../test/fixtures";
import { FROM, message, OWNER } from "../../test/qa-fixtures";
import { createMemoryEmail, noopEmail } from "../platform";
import { listQaMail } from "./list-qa-mail";
import { withQaOutbox } from "./with-qa-outbox";

const NOW = "2026-11-08T12:00:00.000Z";

let harnesses = 0;

function harness() {
  harnesses += 1;
  const inner = createMemoryEmail();
  const email = withQaOutbox(inner, {
    db: testDb(),
    clock: fixedClock(NOW),
    ids: sequentialIds(
      `00000000-0000-4000-a${String(harnesses).padStart(3, "0")}-`
    ),
    from: FROM,
    emailDomain: "qa.flooper.me",
  });
  const stored = (to: string) =>
    listQaMail(
      { db: testDb(), clock: fixedClock(NOW) },
      { to, since: null, subject: null }
    );
  return { inner, email, stored };
}

describe("withQaOutbox", () => {
  it("keeps mail to a QA address instead of sending it", async () => {
    const { inner, email, stored } = harness();
    await email.send(message(OWNER));
    await email.send(message("qa+admin@qa.flooper.me", "Reset your password"));
    expect(inner.sent).toEqual([]);
    expect(await stored(OWNER)).toHaveLength(1);
  });

  it("sends everything else unchanged", async () => {
    const { inner, email, stored } = harness();
    for (const to of [
      "someone@example.com",
      "owner@qa.flooper.me",
      "qa+x@x.qa.flooper.me",
      "qa-20261108kqzt-a@qa.flooper.me",
    ]) {
      await email.send(message(to));
    }
    expect(inner.sent.map((sent) => sent.to.email)).toEqual([
      "someone@example.com",
      "owner@qa.flooper.me",
      "qa+x@x.qa.flooper.me",
      "qa-20261108kqzt-a@qa.flooper.me",
    ]);
    expect(await stored("someone@example.com")).toEqual([]);
  });

  it("splits a mail to QA and real recipients: each real one is still delivered", async () => {
    const { inner, email, stored } = harness();
    // The port sends one recipient per call; a fan-out is one call per recipient.
    const qa = "qa+20261108kqzt-split@qa.flooper.me";
    for (const to of [qa, "member@example.com"]) {
      await email.send(message(to, "Member joined"));
    }
    expect(inner.sent.map((sent) => sent.to.email)).toEqual([
      "member@example.com",
    ]);
    expect((await stored(qa)).map((mail) => mail.subject)).toEqual([
      "Member joined",
    ]);
  });

  it("refuses an invalid message to a QA address like the real adapter", async () => {
    const { email } = harness();
    await expect(
      email.send({ ...message(OWNER), headers: { From: "x@example.com" } })
    ).rejects.toBeInstanceOf(TypeError);
  });

  it("is as enabled as the adapter it wraps", () => {
    expect(
      withQaOutbox(noopEmail, {
        db: testDb(),
        clock: fixedClock(NOW),
        ids: sequentialIds(),
        from: FROM,
        emailDomain: "qa.flooper.me",
      }).enabled
    ).toBe(false);
  });
});
