import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { seedUser, testDb } from "../../test/fixtures";
import { notificationCatalog } from "../notification-catalog";
import { getNotificationPreferences } from "./get-notification-preferences";

describe("getNotificationPreferences", () => {
  it("defaults for a new user: every type, instant mail", async () => {
    const grace = await seedUser("Grace Hopper", "grace.prefs@example.test");
    const result = await getNotificationPreferences(
      { db: testDb(), catalog: notificationCatalog, emailEnabled: true },
      { userId: grace.id }
    );
    expect(result.emailCadence).toBe("instant");
    expect(result.emailAvailable).toBe(true);
    expect(
      result.types.map((row) => [row.type, row.locked, row.inApp, row.email])
    ).toEqual([
      ["workspaces.member-joined", false, true, true],
      ["workspaces.role-changed", false, true, true],
      ["auth.password-changed", true, true, true],
      ["auth.new-sign-in", true, true, true],
      ["auth.factor-changed", true, true, true],
    ]);
  });

  it("applies the user's overrides and cadence", async () => {
    const alan = await seedUser("Alan Turing", "alan.prefs@example.test");
    await env.DB.prepare(
      "INSERT INTO notification_preferences (user_id, type, channel, enabled) VALUES (?, 'workspaces.role-changed', 'email', 0)"
    )
      .bind(alan.id)
      .run();
    await env.DB.prepare(
      "INSERT INTO notification_settings (user_id, email_cadence) VALUES (?, 'daily')"
    )
      .bind(alan.id)
      .run();
    const result = await getNotificationPreferences(
      { db: testDb(), catalog: notificationCatalog, emailEnabled: false },
      { userId: alan.id }
    );
    expect(result.emailCadence).toBe("daily");
    expect(result.emailAvailable).toBe(false);
    expect(result.types[1]).toMatchObject({
      type: "workspaces.role-changed",
      email: false,
    });
  });
});
