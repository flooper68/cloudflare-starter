import { describe, expect, it } from "vitest";

import {
  rows,
  seedNotification,
  seedUser,
  testApp,
  testDb,
} from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import {
  createMemoryEmail,
  createMemoryLogger,
  createMemoryMetrics,
  noopEmail,
} from "../platform";
import { deriveUnsubscribeKey, verifyUnsubscribeToken } from "./domain";
import { sendNotificationEmail } from "./send-notification-email";

function deps(email = createMemoryEmail()) {
  return {
    db: testDb(),
    email,
    logger: createMemoryLogger(),
    metrics: createMemoryMetrics(),
    catalog: notificationCatalog,
    app: testApp,
  };
}

describe("sendNotificationEmail", () => {
  it("mails a pending row with RFC 8058 headers and a working token, then marks it sent", async () => {
    const grace = await seedUser("Grace Hopper", "grace.mail@example.test");
    await seedNotification(grace.id, { id: "n-mail", emailState: "pending" });
    const email = createMemoryEmail();

    const d = deps(email);
    expect(await sendNotificationEmail(d, { notificationId: "n-mail" })).toBe(
      "sent"
    );
    d.metrics.flush();
    expect(d.metrics.exported).toEqual([
      expect.objectContaining({
        name: "app.notifications.sent",
        attributes: {
          "app.notification.type": "workspaces.member-joined",
          "app.notification.channel": "email",
        },
        sum: 1,
      }),
    ]);
    const [mail] = email.sent;
    expect(mail).toMatchObject({
      to: { email: "grace.mail@example.test", name: "Grace Hopper" },
      subject: "Grace Hopper joined Acme Robotics",
      headers: {
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    const header = mail?.headers?.["List-Unsubscribe"] ?? "";
    const token = decodeURIComponent(
      /^<https:\/\/app\.example\.test\/api\/notifications\/unsubscribe\?t=([^>]+)>$/.exec(
        header
      )?.[1] ?? ""
    );
    expect(
      await verifyUnsubscribeToken(
        await deriveUnsubscribeKey(testApp.secret),
        token
      )
    ).toEqual({ userId: grace.id, type: "workspaces.member-joined" });
    expect(mail?.html).toContain("Unsubscribe</a>");
    expect(
      await rows("SELECT email_state FROM notifications WHERE id = 'n-mail'")
    ).toEqual([{ email_state: "sent" }]);

    // A retry after the send does nothing.
    expect(
      await sendNotificationEmail(deps(email), { notificationId: "n-mail" })
    ).toBe("not_pending");
    expect(email.sent).toHaveLength(1);
  });

  it("sends security notices without an unsubscribe header", async () => {
    const ada = await seedUser("Ada Lovelace", "ada.sec@example.test");
    await seedNotification(ada.id, {
      id: "n-sec",
      type: "auth.password-changed",
      data: { method: "change", changedAt: "2026-10-28T11:00:00.000Z" },
      emailState: "pending",
    });
    const email = createMemoryEmail();
    await sendNotificationEmail(deps(email), { notificationId: "n-sec" });
    expect(email.sent[0]?.headers).toEqual({});
    expect(email.sent[0]?.subject).toBe("Your password was changed");
  });

  it("marks the row skipped when email is off", async () => {
    const alan = await seedUser("Alan Turing", "alan.off@example.test");
    await seedNotification(alan.id, { id: "n-off", emailState: "pending" });
    const d = deps(noopEmail as ReturnType<typeof createMemoryEmail>);
    expect(await sendNotificationEmail(d, { notificationId: "n-off" })).toBe(
      "skipped"
    );
    expect(
      await rows("SELECT email_state FROM notifications WHERE id = 'n-off'")
    ).toEqual([{ email_state: "skipped" }]);
    expect(d.logger.records[0]?.body).toBe("notifications.email_skipped");
  });

  it("leaves a missing row alone", async () => {
    expect(
      await sendNotificationEmail(deps(), { notificationId: "n-missing" })
    ).toBe("not_pending");
  });
});
