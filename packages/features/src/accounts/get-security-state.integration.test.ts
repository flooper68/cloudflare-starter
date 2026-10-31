import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedAccount, seedSession } from "../../test/admin-fixtures";
import { testDb } from "../../test/fixtures";
import { getSecurityState } from "./get-security-state";

const settings = {
  mode: "optional",
  emailOtp: false,
  trustedDeviceDays: 0,
  passkeys: true,
} as const;
describe("getSecurityState", () => {
  it("never borrows another user or another session's assurance", async () => {
    const ada = await seedAccount("Ada"),
      grace = await seedAccount("Grace");
    const trusted = await seedSession(ada.id);
    await env.DB.prepare("UPDATE user SET two_factor_enabled = 1 WHERE id = ?")
      .bind(grace.id)
      .run();
    await env.DB.prepare(
      "UPDATE session SET amr = 'otp mfa', second_factor_at = ? WHERE id = ?"
    )
      .bind(Date.now(), trusted)
      .run();
    const state = await getSecurityState(
      { db: testDb(), clock: { now: () => new Date() } },
      { userId: grace.id, sessionId: trusted, settings }
    );
    expect(state).toMatchObject({
      verified: false,
      sessionValid: false,
      decision: "step_up_required",
    });
    expect(JSON.stringify(state)).not.toMatch(
      /secret|backupCodes|publicKey|token/
    );
  });
});
