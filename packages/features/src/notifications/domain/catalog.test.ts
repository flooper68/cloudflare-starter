import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineNotification, type NotificationDefinition } from "../../kernel";
import { notificationCatalog } from "../../notification-catalog";
import { createNotificationCatalog, findNotification } from "./catalog";

function definition(type: string): NotificationDefinition<unknown> {
  return defineNotification({
    type,
    label: "Something happened",
    data: z.object({}),
    defaultChannels: { inApp: true, email: false },
    securityCritical: false,
    render: () => ({
      inApp: { title: "t", body: "b", href: null },
      email: { subject: "s", text: "t", html: "<p>t</p>" },
    }),
  }) as NotificationDefinition<unknown>;
}

describe("notification catalog", () => {
  it("keeps definitions by type, in order", () => {
    const catalog = createNotificationCatalog([
      definition("billing.invoice-paid"),
      definition("billing.card-expiring"),
    ]);
    expect([...catalog.keys()]).toEqual([
      "billing.invoice-paid",
      "billing.card-expiring",
    ]);
    expect(findNotification(catalog, "billing.invoice-paid").type).toBe(
      "billing.invoice-paid"
    );
  });

  it("refuses a duplicate type", () => {
    expect(() =>
      createNotificationCatalog([
        definition("billing.invoice-paid"),
        definition("billing.invoice-paid"),
      ])
    ).toThrow(/listed twice/);
  });

  it.each(["billing", "Billing.Paid", "billing.paid.twice", "billing._x"])(
    "refuses the malformed type %s",
    (type) => {
      expect(() => createNotificationCatalog([definition(type)])).toThrow(
        /<feature>\.<name>/
      );
    }
  );

  it("an unknown type is a permanent invalid_input error", () => {
    expect(() =>
      findNotification(createNotificationCatalog([]), "billing.gone")
    ).toThrow(expect.objectContaining({ kind: "invalid_input" }));
  });

  it("the app's catalog has unique, well-formed types with labels", () => {
    const types = [...notificationCatalog.keys()];
    expect(types).toEqual([
      "workspaces.member-joined",
      "workspaces.role-changed",
      "auth.password-changed",
      "auth.new-sign-in",
      "auth.factor-changed",
    ]);
    for (const entry of notificationCatalog.values()) {
      expect(entry.label.length).toBeGreaterThan(5);
    }
  });
});
