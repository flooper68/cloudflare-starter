import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  rows,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { createMemoryJobQueue, createMemoryLogger } from "../platform";
import { dispatchNotification } from "./dispatch-notification";
import type { NotificationEvent } from "./domain";

let run = 0;

function deps(emailEnabled = true) {
  run += 1;
  return {
    db: testDb(),
    clock: fixedClock(),
    ids: sequentialIds(`0000000${run}-0000-4000-8000-`),
    logger: createMemoryLogger(),
    jobQueue: createMemoryJobQueue(),
    email: { enabled: emailEnabled },
    catalog: notificationCatalog,
  };
}

function event(id: string, workspaceId: string): NotificationEvent {
  return {
    specversion: "1.0",
    id,
    source: "/local/http",
    type: "workspaces.member-joined",
    time: "2026-10-28T12:00:00.000Z",
    datacontenttype: "application/json",
    data: {
      workspaceId,
      workspaceName: "Acme Robotics",
      memberName: "Grace Hopper",
      role: "member",
    },
    workspaceid: workspaceId,
  };
}

async function prefer(
  userId: string,
  type: string,
  channel: string,
  enabled: boolean
) {
  await env.DB.prepare(
    "INSERT INTO notification_preferences (user_id, type, channel, enabled) VALUES (?, ?, ?, ?)"
  )
    .bind(userId, type, channel, enabled ? 1 : 0)
    .run();
}

describe("dispatchNotification", () => {
  it("writes rows per preferences and enqueues mail only for what is due now", async () => {
    const ada = await seedUser("Ada Lovelace");
    const alan = await seedUser("Alan Turing");
    const barbara = await seedUser("Barbara Liskov");
    const ken = await seedUser("Ken Thompson");
    await seedWorkspace(ada.id, { id: "ws-dispatch" });
    // Alan: no email for this type; Barbara: daily digest; Ken: nothing at all.
    await prefer(alan.id, "workspaces.member-joined", "email", false);
    await env.DB.prepare(
      "INSERT INTO notification_settings (user_id, email_cadence) VALUES (?, 'daily')"
    )
      .bind(barbara.id)
      .run();
    await prefer(ken.id, "workspaces.member-joined", "email", false);
    await prefer(ken.id, "workspaces.member-joined", "inApp", false);

    const d = deps();
    const result = await dispatchNotification(d, {
      event: event("evt-1", "ws-dispatch"),
      recipients: [ada.id, alan.id, barbara.id, ken.id, "user-deleted"],
      context: testRequestContext(),
    });

    expect(result).toEqual({ rows: 3, emails: 1 });
    expect(
      await rows(
        "SELECT user_id, workspace_id, in_app, email_state, created_at FROM notifications WHERE event_id = 'evt-1' ORDER BY user_id"
      )
    ).toEqual([
      {
        user_id: ada.id,
        workspace_id: "ws-dispatch",
        in_app: 1,
        email_state: "pending",
        created_at: Date.parse("2026-10-28T12:00:00.000Z"),
      },
      expect.objectContaining({ user_id: alan.id, email_state: "none" }),
      expect.objectContaining({
        user_id: barbara.id,
        email_state: "pending_digest",
      }),
    ]);
    expect(d.jobQueue.sent.map((sent) => sent.envelope)).toEqual([
      expect.objectContaining({
        type: "notifications.send-email",
        idempotencykey: expect.stringMatching(
          /^notifications\.send-email:email-/
        ),
      }),
    ]);

    // Redelivered: no new rows; the pending mail is enqueued again (its key dedups it).
    const again = deps();
    expect(
      await dispatchNotification(again, {
        event: event("evt-1", "ws-dispatch"),
        recipients: [ada.id, alan.id, barbara.id],
        context: testRequestContext(),
      })
    ).toMatchObject({ emails: 1 });
    expect(
      await rows(
        "SELECT count(*) AS n FROM notifications WHERE event_id = 'evt-1'"
      )
    ).toEqual([{ n: 3 }]);
  });

  it("marks email skipped with a warning when the deployment has no email", async () => {
    const grace = await seedUser("Grace Hopper", "grace.skip@example.test");
    const d = deps(false);
    await dispatchNotification(d, {
      event: { ...event("evt-2", "ws-none"), workspaceid: undefined },
      recipients: [grace.id],
      context: testRequestContext(),
    });
    expect(
      await rows(
        "SELECT email_state, in_app FROM notifications WHERE event_id = 'evt-2'"
      )
    ).toEqual([{ email_state: "skipped", in_app: 1 }]);
    expect(d.jobQueue.sent).toEqual([]);
    expect(d.logger.records).toEqual([
      expect.objectContaining({
        body: "notifications.email_skipped",
        attributes: expect.objectContaining({ "app.notification.skipped": 1 }),
      }),
    ]);
  });

  it("always mails a security notification, ignoring overrides and the digest", async () => {
    const nicole = await seedUser("Nicole Example", "nicole.sec@example.test");
    await prefer(nicole.id, "auth.new-sign-in", "email", false);
    await env.DB.prepare(
      "INSERT INTO notification_settings (user_id, email_cadence) VALUES (?, 'daily')"
    )
      .bind(nicole.id)
      .run();
    const d = deps();
    await dispatchNotification(d, {
      event: {
        ...event("evt-3", "x"),
        type: "auth.new-sign-in",
        workspaceid: undefined,
        data: {
          userAgent: "Firefox",
          ip: null,
          signedInAt: "2026-10-28T12:00:00.000Z",
        },
      },
      recipients: [nicole.id],
      context: testRequestContext(),
    });
    expect(
      await rows(
        "SELECT email_state FROM notifications WHERE event_id = 'evt-3'"
      )
    ).toEqual([{ email_state: "pending" }]);
  });

  it("fails permanently for an unknown type or invalid data", async () => {
    await expect(
      dispatchNotification(deps(), {
        event: { ...event("evt-4", "x"), type: "billing.gone" },
        recipients: ["u"],
        context: testRequestContext(),
      })
    ).rejects.toMatchObject({ kind: "invalid_input" });
    await expect(
      dispatchNotification(deps(), {
        event: { ...event("evt-5", "x"), data: {} },
        recipients: ["u"],
        context: testRequestContext(),
      })
    ).rejects.toMatchObject({ kind: "invalid_input" });
  });
});
