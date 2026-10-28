import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  notificationsSent,
  seedUser,
  testRequestContext,
  useCaseDeps,
} from "../../test/fixtures";
import { notifyNewSignIn } from "./notify-new-sign-in";

const FIREFOX = "Mozilla/5.0 (Macintosh) Firefox/140.0";

async function seedSession(
  id: string,
  userId: string,
  userAgent: string,
  expiresAt: string
) {
  await env.DB.prepare(
    "INSERT INTO session (id, expires_at, token, created_at, updated_at, user_agent, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      Date.parse(expiresAt),
      `token-${id}`,
      Date.now(),
      Date.now(),
      userAgent,
      userId
    )
    .run();
}

/** The account was created at `iso` (seedUser stamps the real time). */
async function createdAt(userId: string, iso: string) {
  await env.DB.prepare("UPDATE user SET created_at = ? WHERE id = ?")
    .bind(Date.parse(iso), userId)
    .run();
}

describe("notifyNewSignIn", () => {
  it("notifies a sign-in from a browser with no other live session, not a repeat", async () => {
    const grace = await seedUser("Grace Hopper", "grace.signin@example.test");
    await createdAt(grace.id, "2026-10-01T12:00:00.000Z");
    const deps = useCaseDeps();
    const input = (sessionId: string, userAgent: string) => ({
      userId: grace.id,
      sessionId,
      userAgent,
      ip: "203.0.113.7",
      requestContext: testRequestContext({ userId: grace.id }),
    });

    await seedSession("s-1", grace.id, FIREFOX, "2026-11-04T12:00:00.000Z");
    expect(await notifyNewSignIn(deps, input("s-1", FIREFOX))).toBe(true);
    await seedSession("s-2", grace.id, FIREFOX, "2026-11-04T12:00:00.000Z");
    expect(await notifyNewSignIn(deps, input("s-2", FIREFOX))).toBe(false);

    expect(notificationsSent(deps.jobQueue)).toEqual([
      {
        type: "auth.new-sign-in",
        recipients: [grace.id],
        workspaceId: null,
        data: {
          userAgent: FIREFOX,
          ip: "203.0.113.7",
          signedInAt: "2026-10-28T12:00:00.000Z",
        },
      },
    ]);
  });

  it("ignores expired sessions of the same browser", async () => {
    const alan = await seedUser("Alan Turing", "alan.signin@example.test");
    await createdAt(alan.id, "2026-10-01T12:00:00.000Z");
    await seedSession("s-old", alan.id, FIREFOX, "2026-10-01T00:00:00.000Z");
    await seedSession("s-new", alan.id, FIREFOX, "2026-11-04T12:00:00.000Z");
    const deps = useCaseDeps();
    expect(
      await notifyNewSignIn(deps, {
        userId: alan.id,
        sessionId: "s-new",
        userAgent: FIREFOX,
        ip: null,
        requestContext: testRequestContext({ userId: alan.id }),
      })
    ).toBe(true);
  });

  it("stays quiet for a brand-new account (a Google sign-up signs in through the callback)", async () => {
    const ken = await seedUser("Ken Thompson", "ken.signin@example.test");
    await createdAt(ken.id, "2026-10-28T11:59:40.000Z");
    await seedSession("s-ken", ken.id, FIREFOX, "2026-11-04T12:00:00.000Z");
    const deps = useCaseDeps();
    expect(
      await notifyNewSignIn(deps, {
        userId: ken.id,
        sessionId: "s-ken",
        userAgent: FIREFOX,
        ip: null,
        requestContext: testRequestContext({ userId: ken.id }),
      })
    ).toBe(false);
    expect(notificationsSent(deps.jobQueue)).toEqual([]);
  });
});
