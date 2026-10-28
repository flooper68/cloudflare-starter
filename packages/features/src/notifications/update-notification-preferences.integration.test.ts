import { describe, expect, it } from "vitest";

import {
  rows,
  seedUser,
  useCaseDeps,
  userAuditTrail,
} from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { updateNotificationPreferences } from "./update-notification-preferences";

describe("updateNotificationPreferences", () => {
  it("stores only differences from the defaults, sets the cadence and records the change", async () => {
    const grace = await seedUser("Grace Hopper", "grace.update@example.test");
    const deps = { ...useCaseDeps(), catalog: notificationCatalog };

    await updateNotificationPreferences(deps, {
      userId: grace.id,
      changes: [
        { type: "workspaces.member-joined", channel: "email", enabled: false },
        { type: "workspaces.role-changed", channel: "inApp", enabled: false },
      ],
      emailCadence: "daily",
    });
    expect(
      await rows(
        "SELECT type, channel, enabled FROM notification_preferences WHERE user_id = ? ORDER BY type",
        grace.id
      )
    ).toEqual([
      { type: "workspaces.member-joined", channel: "email", enabled: 0 },
      { type: "workspaces.role-changed", channel: "inApp", enabled: 0 },
    ]);
    expect(
      await rows(
        "SELECT email_cadence FROM notification_settings WHERE user_id = ?",
        grace.id
      )
    ).toEqual([{ email_cadence: "daily" }]);

    // Back to the default: the override is removed.
    await updateNotificationPreferences(deps, {
      userId: grace.id,
      changes: [
        { type: "workspaces.member-joined", channel: "email", enabled: true },
      ],
    });
    expect(
      await rows(
        "SELECT type FROM notification_preferences WHERE user_id = ?",
        grace.id
      )
    ).toEqual([{ type: "workspaces.role-changed" }]);

    expect(await userAuditTrail(grace.id)).toEqual([
      {
        action: "notifications.preferences_changed",
        actor: grace.id,
        metadata: { changes: 2, emailCadence: "daily" },
      },
      {
        action: "notifications.preferences_changed",
        actor: grace.id,
        metadata: { changes: 1 },
      },
    ]);
  });

  it("refuses security types and unknown types before writing", async () => {
    const alan = await seedUser("Alan Turing", "alan.update@example.test");
    const deps = { ...useCaseDeps(), catalog: notificationCatalog };
    await expect(
      updateNotificationPreferences(deps, {
        userId: alan.id,
        changes: [
          {
            type: "workspaces.member-joined",
            channel: "email",
            enabled: false,
          },
          { type: "auth.new-sign-in", channel: "email", enabled: false },
        ],
      })
    ).rejects.toMatchObject({ name: "NotificationPreferenceLockedError" });
    await expect(
      updateNotificationPreferences(deps, {
        userId: alan.id,
        changes: [{ type: "billing.nope", channel: "email", enabled: false }],
      })
    ).rejects.toMatchObject({ name: "UnknownNotificationTypeError" });
    expect(
      await rows(
        "SELECT count(*) AS n FROM notification_preferences WHERE user_id = ?",
        alan.id
      )
    ).toEqual([{ n: 0 }]);
    expect(await userAuditTrail(alan.id)).toEqual([]);
  });
});
