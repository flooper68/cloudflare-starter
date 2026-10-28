import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedNotification,
  seedUser,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { createMemoryJobQueue } from "../platform";
import { planDigests } from "./plan-digests";

describe("planDigests", () => {
  it("enqueues one digest per user with rows waiting up to asOf", async () => {
    const grace = await seedUser("Grace Hopper", "grace.plan@example.test");
    const alan = await seedUser("Alan Turing", "alan.plan@example.test");
    const ada = await seedUser("Ada Lovelace", "ada.plan@example.test");
    const early = "2026-10-28T07:00:00.000Z";
    await seedNotification(grace.id, {
      id: "p-1",
      emailState: "pending_digest",
      createdAt: early,
    });
    await seedNotification(grace.id, {
      id: "p-2",
      emailState: "pending_digest",
      createdAt: early,
    });
    await seedNotification(alan.id, {
      id: "p-3",
      emailState: "pending_digest",
      createdAt: "2026-10-28T09:00:00.000Z",
    });
    await seedNotification(ada.id, { id: "p-4", emailState: "sent" });
    const jobQueue = createMemoryJobQueue();

    const result = await planDigests(
      { db: testDb(), jobQueue, clock: fixedClock(), ids: sequentialIds() },
      {
        asOf: new Date("2026-10-28T08:00:00.000Z"),
        context: testRequestContext({ source: "queue" }),
      }
    );
    // Alan's row arrived after the run's time: tomorrow's digest.
    expect(result).toEqual({ users: 1 });
    expect(jobQueue.sent.map((sent) => sent.envelope.idempotencykey)).toEqual([
      `notifications.send-digest:digest-${grace.id}-2026-10-28`,
    ]);

    const later = await planDigests(
      { db: testDb(), jobQueue, clock: fixedClock(), ids: sequentialIds() },
      {
        asOf: new Date("2026-10-28T12:00:00.000Z"),
        context: testRequestContext({ source: "queue" }),
      }
    );
    // A second run the same day: the same key for Grace (her digest is sent once).
    expect(later).toEqual({ users: 2 });
    expect(
      jobQueue.sent
        .slice(1)
        .map((sent) => sent.envelope.idempotencykey)
        .sort()
    ).toEqual(
      [
        `notifications.send-digest:digest-${alan.id}-2026-10-28`,
        `notifications.send-digest:digest-${grace.id}-2026-10-28`,
      ].sort()
    );
  });
});
