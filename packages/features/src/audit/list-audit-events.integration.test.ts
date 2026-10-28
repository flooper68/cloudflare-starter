import { beforeAll, describe, expect, it } from "vitest";

import {
  fixedClock,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { type AuditEventInput, InvalidAuditInputError } from "./domain";
import { listAuditEvents } from "./list-audit-events";
import { recordAuditEvent } from "./record-audit-event";

const ids = sequentialIds();

function record(at: string, userId: string | null, event: AuditEventInput) {
  return recordAuditEvent(
    { db: testDb(), clock: fixedClock(at), ids },
    testRequestContext({ userId }),
    event
  );
}

const signIn = (userId: string): AuditEventInput => ({
  action: "auth.sign_in",
  target: { type: "user", id: userId },
  metadata: { method: "password" },
});

describe("listAuditEvents", () => {
  beforeAll(async () => {
    await record("2026-10-01T09:00:00.000Z", "user-ada", signIn("user-ada"));
    await record(
      "2026-10-02T09:00:00.000Z",
      "user-grace",
      signIn("user-grace")
    );
    // Two events in the same millisecond: the insertion order breaks the tie.
    await record("2026-10-03T09:00:00.000Z", "user-ada", {
      action: "workspace.member_removed",
      workspaceId: "ws-1",
      target: { type: "user", id: "user-alan" },
    });
    await record("2026-10-03T09:00:00.000Z", null, {
      action: "auth.sign_in_failed",
      target: { type: "email", id: "ada@example.test" },
      metadata: { method: "password", reason: "INVALID_EMAIL_OR_PASSWORD" },
    });
    await record("2026-10-04T09:00:00.000Z", "user-ada", signIn("user-ada"));
  });

  it("lists everything newest first, ties in reverse insertion order", async () => {
    const page = await listAuditEvents({ db: testDb() });
    expect(
      page.events.map((event) => [event.occurredAt, event.action])
    ).toEqual([
      ["2026-10-04T09:00:00.000Z", "auth.sign_in"],
      ["2026-10-03T09:00:00.000Z", "auth.sign_in_failed"],
      ["2026-10-03T09:00:00.000Z", "workspace.member_removed"],
      ["2026-10-02T09:00:00.000Z", "auth.sign_in"],
      ["2026-10-01T09:00:00.000Z", "auth.sign_in"],
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("pages with a cursor without skipping or repeating events", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await listAuditEvents(
        { db: testDb() },
        { limit: 2, cursor }
      );
      seen.push(...page.events.map((event) => event.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor);

    const all = await listAuditEvents({ db: testDb() });
    expect(pages).toBe(3);
    expect(seen).toEqual(all.events.map((event) => event.id));
  });

  it("filters by actor, action, target, workspace and time range", async () => {
    const list = async (filters: Parameters<typeof listAuditEvents>[1]) =>
      (await listAuditEvents({ db: testDb() }, filters)).events.map(
        (event) => `${event.occurredAt.slice(0, 10)} ${event.action}`
      );

    expect(await list({ actorUserId: "user-ada" })).toEqual([
      "2026-10-04 auth.sign_in",
      "2026-10-03 workspace.member_removed",
      "2026-10-01 auth.sign_in",
    ]);
    expect(
      await list({ action: "auth.sign_in", actorUserId: "user-ada" })
    ).toEqual(["2026-10-04 auth.sign_in", "2026-10-01 auth.sign_in"]);
    expect(
      await list({ targetType: "email", targetId: "ada@example.test" })
    ).toEqual(["2026-10-03 auth.sign_in_failed"]);
    expect(await list({ workspaceId: "ws-1" })).toEqual([
      "2026-10-03 workspace.member_removed",
    ]);
    expect(
      await list({
        from: "2026-10-02T09:00:00.000Z",
        to: "2026-10-04T09:00:00.000Z",
      })
    ).toEqual([
      "2026-10-03 auth.sign_in_failed",
      "2026-10-03 workspace.member_removed",
      "2026-10-02 auth.sign_in",
    ]);
  });

  it("rejects an invalid query or cursor", async () => {
    await expect(
      listAuditEvents({ db: testDb() }, { limit: 0 })
    ).rejects.toThrow(InvalidAuditInputError);
    await expect(
      listAuditEvents({ db: testDb() }, { cursor: "not-a-cursor" })
    ).rejects.toThrow(InvalidAuditInputError);
  });
  it("orders same-millisecond events by insertion, whatever their ids", async () => {
    // Random ids in production: here the later event gets the smaller id.
    const descending = ["evt-z", "evt-a"];
    const at = "2026-10-05T09:00:00.000Z";
    for (const userId of ["user-first", "user-second"]) {
      await recordAuditEvent(
        {
          db: testDb(),
          clock: fixedClock(at),
          ids: { uuid: () => descending.shift() ?? "evt-x" },
        },
        testRequestContext({ userId }),
        signIn(userId)
      );
    }
    const page = await listAuditEvents(
      { db: testDb() },
      { from: at, limit: 1 }
    );
    expect(page.events.map((event) => event.target.id)).toEqual([
      "user-second",
    ]);
    const next = await listAuditEvents(
      { db: testDb() },
      { from: at, limit: 1, cursor: page.nextCursor ?? undefined }
    );
    expect(next.events.map((event) => event.target.id)).toEqual(["user-first"]);
  });
});
