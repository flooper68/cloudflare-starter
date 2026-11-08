import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount } from "../../test/admin-fixtures";
import { createMemoryEmail, noopEmail } from "../platform";
import { sendAdminTestEmail } from "./send-admin-test-email";

describe("sendAdminTestEmail", () => {
  it("sends the test email to the address and records it", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const email = createMemoryEmail();
    const deps = { ...adminDeps(), email };
    expect(
      await sendAdminTestEmail(
        deps,
        { userId: admin.id },
        {
          to: "Delivery@Example.test",
          environment: "production",
        }
      )
    ).toEqual({ sent: true });
    expect(email.sent).toEqual([
      expect.objectContaining({
        to: { email: "Delivery@Example.test" },
        subject: "[production] Starter kit test email",
      }),
    ]);
    const { results } = await env.DB.prepare(
      "SELECT action, target_id AS target FROM audit_events WHERE action = 'admin.test_email_sent'"
    ).all<{ action: string; target: string }>();
    expect(results).toEqual([
      { action: "admin.test_email_sent", target: "delivery@example.test" },
    ]);
  });

  it("is refused where email is off", async () => {
    const admin = await seedAccount("Bo Admin", { role: "admin" });
    await expect(
      sendAdminTestEmail(
        { ...adminDeps(), email: noopEmail },
        { userId: admin.id },
        {
          to: "x@example.test",
          environment: "production",
        }
      )
    ).rejects.toMatchObject({ kind: "unavailable" });
  });
});
