import { describe, expect, it } from "vitest";

import {
  rows,
  seedNotification,
  seedUser,
  testApp,
  testDb,
} from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { createMemoryEmail, createMemoryLogger } from "../platform";
import { deriveUnsubscribeKey, verifyUnsubscribeToken } from "./domain";
import { sendDigest } from "./send-digest";

const asOf = new Date("2026-10-28T12:00:00.000Z");

describe("sendDigest", () => {
  it("mails the waiting rows grouped by type with an unsubscribe-all link, then marks them sent", async () => {
    const grace = await seedUser("Grace Hopper", "grace.digest@example.test");
    await seedNotification(grace.id, {
      id: "d-1",
      emailState: "pending_digest",
    });
    await seedNotification(grace.id, {
      id: "d-2",
      emailState: "pending_digest",
      data: {
        workspaceId: "ws-acme",
        workspaceName: "Acme Robotics",
        memberName: "Alan Turing",
        role: "member",
      },
    });
    await seedNotification(grace.id, {
      id: "d-3",
      type: "workspaces.role-changed",
      data: {
        workspaceId: "ws-acme",
        workspaceName: "Acme Robotics",
        role: "owner",
        previousRole: "member",
      },
      emailState: "pending_digest",
    });
    await seedNotification(grace.id, { id: "d-4", emailState: "none" });
    const email = createMemoryEmail();

    const result = await sendDigest(
      {
        db: testDb(),
        email,
        logger: createMemoryLogger(),
        catalog: notificationCatalog,
        app: testApp,
      },
      { userId: grace.id, asOf }
    );

    expect(result).toEqual({ sent: 3 });
    expect(email.sent).toHaveLength(1);
    const [mail] = email.sent;
    expect(mail?.subject).toBe("Your daily summary: 3 notifications");
    expect(mail?.text).toContain("Someone joins a workspace you manage (2)");
    expect(mail?.text).toContain("Your role in a workspace changes (1)");
    const token = decodeURIComponent(
      /\?t=([^>]+)>$/.exec(mail?.headers?.["List-Unsubscribe"] ?? "")?.[1] ?? ""
    );
    expect(
      await verifyUnsubscribeToken(
        await deriveUnsubscribeKey(testApp.secret),
        token
      )
    ).toEqual({ userId: grace.id, type: "*" });
    expect(
      await rows(
        "SELECT id, email_state FROM notifications WHERE user_id = ? ORDER BY id",
        grace.id
      )
    ).toEqual([
      { id: "d-1", email_state: "sent" },
      { id: "d-2", email_state: "sent" },
      { id: "d-3", email_state: "sent" },
      { id: "d-4", email_state: "none" },
    ]);

    // Nothing left: nothing sent.
    expect(
      await sendDigest(
        {
          db: testDb(),
          email,
          logger: createMemoryLogger(),
          catalog: notificationCatalog,
          app: testApp,
        },
        { userId: grace.id, asOf }
      )
    ).toEqual({ sent: 0 });
    expect(email.sent).toHaveLength(1);
  });
});
