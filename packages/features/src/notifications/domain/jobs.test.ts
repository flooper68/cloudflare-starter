import { describe, expect, it } from "vitest";

import {
  decodeInboxCursor,
  encodeInboxCursor,
  markReadInputSchema,
} from "./inbox";
import {
  dispatchNotificationJob,
  MAX_RECIPIENTS,
  planDigestsJob,
  purgeNotificationsJob,
  sendDigestJob,
  sendNotificationEmailJob,
} from "./jobs";

const event = {
  specversion: "1.0" as const,
  id: "6f1c2d3e-0000-4000-8000-000000000001",
  source: "/local/http",
  type: "workspaces.member-joined",
  time: "2026-10-28T12:00:00.000Z",
  datacontenttype: "application/json" as const,
  data: { workspaceName: "Acme" },
  workspaceid: "ws-acme",
};

describe("notification jobs", () => {
  it("dispatch takes a CloudEvents event and recipients, keyed by the event id", () => {
    const payload = { event, recipients: ["user-grace"] };
    expect(dispatchNotificationJob.payload.safeParse(payload).success).toBe(
      true
    );
    expect(dispatchNotificationJob.idempotencyKey?.(payload)).toBe(event.id);
    for (const bad of [
      { event, recipients: [] },
      {
        event,
        recipients: Array.from(
          { length: MAX_RECIPIENTS + 1 },
          (_, i) => `u${i}`
        ),
      },
      { event: { ...event, specversion: "0.3" }, recipients: ["u"] },
      { event: { ...event, extra: 1 }, recipients: ["u"] },
    ]) {
      expect(dispatchNotificationJob.payload.safeParse(bad).success).toBe(
        false
      );
    }
  });

  it("send-email is keyed by the row, send-digest by user and UTC day", () => {
    expect(
      sendNotificationEmailJob.idempotencyKey?.({ notificationId: "n-1" })
    ).toBe("email-n-1");
    expect(
      sendDigestJob.idempotencyKey?.({
        userId: "user-grace",
        asOf: "2026-10-28T08:00:00.000Z",
      })
    ).toBe("digest-user-grace-2026-10-28");
    expect(
      sendNotificationEmailJob.payload.safeParse({ notificationId: "" }).success
    ).toBe(false);
  });

  it("plan-digests and purge take the cron run's time", () => {
    for (const job of [planDigestsJob, purgeNotificationsJob]) {
      expect(
        job.payload.safeParse({ asOf: "2026-10-28T08:00:00.000Z" }).success
      ).toBe(true);
      expect(job.payload.safeParse({ asOf: "yesterday" }).success).toBe(false);
      expect(job.idempotencyKey).toBeUndefined();
    }
  });
});

describe("inbox inputs", () => {
  it("markRead takes ids or all, not both, and a workspace only with all", () => {
    const ok = (input: unknown) => markReadInputSchema.safeParse(input).success;
    expect(ok({ ids: ["n-1"] })).toBe(true);
    expect(ok({ all: true })).toBe(true);
    expect(ok({ all: true, workspaceId: "ws-acme" })).toBe(true);
    expect(ok({})).toBe(false);
    expect(ok({ ids: ["n-1"], all: true })).toBe(false);
    expect(ok({ ids: ["n-1"], workspaceId: "ws-acme" })).toBe(false);
  });

  it("cursors round-trip and reject garbage", () => {
    const cursor = {
      createdAt: new Date("2026-10-28T12:00:00.000Z"),
      id: "n-1",
    };
    expect(decodeInboxCursor(encodeInboxCursor(cursor))).toEqual(cursor);
    expect(decodeInboxCursor("nope")).toBe(null);
  });
});
