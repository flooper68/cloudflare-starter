import { describe, expect, it } from "vitest";
import { newSignInNotification } from "../accounts";
import type { RequestContext } from "../kernel";
import { createMemoryJobQueue } from "../platform";
import { memberJoinedNotification } from "../workspaces";
import { notify } from "./notify";

const requestContext: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "http",
  userId: "user-grace",
  workspaceId: "ws-acme",
  ip: "203.0.113.7",
  release: "local",
  environment: "develop",
};

function deps() {
  let next = 0;
  return {
    jobQueue: createMemoryJobQueue(),
    clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
    ids: { uuid: () => `00000000-0000-4000-8000-00000000000${++next}` },
  };
}

const data = {
  workspaceId: "ws-acme",
  workspaceName: "Acme Robotics",
  memberName: "Grace Hopper",
  role: "member",
};

describe("notify", () => {
  it("enqueues one dispatch job: a CloudEvents event keyed by its id, without the actor", async () => {
    const d = deps();
    const result = await notify(d, memberJoinedNotification, {
      recipients: ["user-ada", "user-grace", "user-ada", "user-alan"],
      data,
      context: { workspaceId: "ws-acme", requestContext },
    });
    expect(result).toEqual({
      eventId: "00000000-0000-4000-8000-000000000001",
      recipients: 2,
    });
    expect(d.jobQueue.sent).toHaveLength(1);
    const envelope = d.jobQueue.sent[0]?.envelope;
    expect(envelope).toMatchObject({
      type: "notifications.dispatch",
      idempotencykey: `notifications.dispatch:${result.eventId}`,
      userid: "user-grace",
      data: {
        event: {
          specversion: "1.0",
          id: result.eventId,
          source: "/develop/http",
          type: "workspaces.member-joined",
          time: "2026-10-28T12:00:00.000Z",
          datacontenttype: "application/json",
          data,
          workspaceid: "ws-acme",
        },
        recipients: ["user-ada", "user-alan"],
      },
    });
  });

  it("keeps the actor for a security notification", async () => {
    const d = deps();
    const result = await notify(d, newSignInNotification, {
      recipients: ["user-grace"],
      data: {
        userAgent: "Firefox",
        ip: null,
        signedInAt: "2026-10-28T12:00:00.000Z",
      },
      context: { workspaceId: null, requestContext },
    });
    expect(result.recipients).toBe(1);
    expect(d.jobQueue.sent[0]?.envelope.data).toMatchObject({
      recipients: ["user-grace"],
    });
  });

  it("enqueues nothing when only the actor would get it", async () => {
    const d = deps();
    expect(
      await notify(d, memberJoinedNotification, {
        recipients: ["user-grace"],
        data,
        context: { workspaceId: "ws-acme", requestContext },
      })
    ).toMatchObject({ recipients: 0 });
    expect(d.jobQueue.sent).toEqual([]);
  });

  it("refuses data the definition does not accept, before enqueueing", async () => {
    const d = deps();
    await expect(
      notify(d, memberJoinedNotification, {
        recipients: ["user-ada"],
        data: { ...data, memberName: "" },
        context: { workspaceId: "ws-acme", requestContext },
      })
    ).rejects.toMatchObject({
      name: "InvalidNotificationDataError",
      kind: "invalid_input",
    });
    expect(d.jobQueue.sent).toEqual([]);
  });

  it("refuses more than 500 recipients", async () => {
    await expect(
      notify(deps(), memberJoinedNotification, {
        recipients: Array.from({ length: 501 }, (_, i) => `user-${i}`),
        data,
        context: { workspaceId: "ws-acme", requestContext },
      })
    ).rejects.toMatchObject({ name: "TooManyRecipientsError" });
  });
});
