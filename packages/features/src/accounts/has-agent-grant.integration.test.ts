import { describe, expect, it } from "vitest";
import { seedAgentGrant } from "../../test/agent-fixtures";
import { seedUser, testDb } from "../../test/fixtures";
import { hasAgentGrant } from "./has-agent-grant";

describe("hasAgentGrant", () => {
  it("accepts tokens issued after the user's consent for that client only", async () => {
    const user = await seedUser("Ada Grant");
    const other = await seedUser("Grace Grant");
    const consentedAt = Date.parse("2026-11-08T09:00:00Z");
    await seedAgentGrant({ userId: user.id, clientId: "claude", consentedAt });
    const deps = { db: testDb() };
    const issued = consentedAt / 1000 + 5;

    expect(
      await hasAgentGrant(deps, {
        userId: user.id,
        clientId: "claude",
        issuedAtSeconds: issued,
      })
    ).toBe(true);
    // A token from before this consent (e.g. before a disconnect and re-approval).
    expect(
      await hasAgentGrant(deps, {
        userId: user.id,
        clientId: "claude",
        issuedAtSeconds: consentedAt / 1000 - 60,
      })
    ).toBe(false);
    // Another client, or another user with the same client id.
    expect(
      await hasAgentGrant(deps, {
        userId: user.id,
        clientId: "other-client",
        issuedAtSeconds: issued,
      })
    ).toBe(false);
    expect(
      await hasAgentGrant(deps, {
        userId: other.id,
        clientId: "claude",
        issuedAtSeconds: issued,
      })
    ).toBe(false);
  });
});
