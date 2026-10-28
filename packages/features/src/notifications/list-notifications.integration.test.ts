import { describe, expect, it } from "vitest";

import { seedNotification, seedUser, testDb } from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { listNotifications } from "./list-notifications";

const deps = () => ({
  db: testDb(),
  catalog: notificationCatalog,
  appUrl: "https://app.example.test",
});

describe("listNotifications", () => {
  it("lists the user's in-app rows newest first, rendered, a page at a time", async () => {
    const grace = await seedUser("Grace Hopper", "grace.list@example.test");
    const alan = await seedUser("Alan Turing", "alan.list@example.test");
    const at = (minute: number) =>
      `2026-10-28T11:${String(minute).padStart(2, "0")}:00.000Z`;
    await seedNotification(grace.id, { id: "l-1", createdAt: at(1) });
    await seedNotification(grace.id, {
      id: "l-2",
      createdAt: at(2),
      readAt: at(3),
    });
    await seedNotification(grace.id, { id: "l-3", createdAt: at(3) });
    await seedNotification(grace.id, {
      id: "l-4",
      createdAt: at(4),
      archivedAt: at(5),
    });
    await seedNotification(grace.id, {
      id: "l-5",
      createdAt: at(5),
      inApp: false,
    });
    await seedNotification(grace.id, {
      id: "l-6",
      createdAt: at(6),
      type: "billing.removed-type",
    });
    await seedNotification(alan.id, { id: "l-7", createdAt: at(7) });

    const first = await listNotifications(deps(), {
      userId: grace.id,
      view: "inbox",
      limit: 2,
    });
    expect(first.items.map((item) => item.id)).toEqual(["l-6", "l-3"]);
    expect(first.items[0]).toMatchObject({
      title: "Notification",
      href: null,
    });
    expect(first.items[1]).toMatchObject({
      type: "workspaces.member-joined",
      title: "Grace Hopper joined Acme Robotics",
      href: "/app/members",
      readAt: null,
      createdAt: at(3),
    });
    const second = await listNotifications(deps(), {
      userId: grace.id,
      view: "inbox",
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((item) => item.id)).toEqual(["l-2", "l-1"]);
    expect(second.nextCursor).toBe(null);

    const unread = await listNotifications(deps(), {
      userId: grace.id,
      view: "unread",
      limit: 10,
    });
    expect(unread.items.map((item) => item.id)).toEqual(["l-6", "l-3", "l-1"]);
    const archived = await listNotifications(deps(), {
      userId: grace.id,
      view: "archived",
      limit: 10,
    });
    expect(archived.items.map((item) => item.id)).toEqual(["l-4"]);
  });
});
