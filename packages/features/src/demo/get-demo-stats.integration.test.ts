import { describe, expect, it } from "vitest";

import {
  DEMO_NOW,
  daysBefore,
  demoPolicy,
  seedDemoUser,
} from "../../test/demo-fixtures";
import {
  fixedClock,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { recordAuditEvent } from "../audit";
import { getDemoStats } from "./get-demo-stats";

const admin = { userId: "user-admin" };

async function erasedAt(userId: string, at: Date) {
  await recordAuditEvent(
    {
      db: testDb(),
      clock: { now: () => at },
      ids: sequentialIds(
        `${userId.slice(-8).padStart(8, "0")}-5555-4000-8000-`
      ),
    },
    testRequestContext({ source: "queue" }),
    {
      action: "demo.account_erased",
      actor: { kind: "system" },
      target: { type: "user", id: userId },
      metadata: { retentionDays: 7 },
    }
  );
}

describe("getDemoStats", () => {
  it("counts active demo accounts, deletions due today and erasures of the last 7 days", async () => {
    await seedDemoUser("new@example.test", daysBefore(1));
    // Created 6.9 days before 03:17: due at 05:41 today.
    await seedDemoUser("today@example.test", daysBefore(6.9));
    await seedDemoUser("overdue@example.test", daysBefore(12));
    await seedDemoUser("tomorrow@example.test", daysBefore(5.5));
    // Not demo accounts: never counted.
    await seedDemoUser("root@example.test", daysBefore(30), {
      role: "user,admin",
    });
    await seedDemoUser("founder@flooper.test", daysBefore(30));
    await seedDemoUser("OWNER@flooper.test", daysBefore(30));
    await seedDemoUser("qa+1@qa.flooper.test", daysBefore(30));
    await erasedAt("user-erased-a", daysBefore(1));
    await erasedAt("user-erased-b", daysBefore(6));
    await erasedAt("user-erased-c", daysBefore(8));

    expect(
      await getDemoStats(
        { db: testDb(), clock: fixedClock(DEMO_NOW) },
        admin,
        demoPolicy
      )
    ).toEqual({
      retentionDays: 7,
      activeAccounts: 4,
      scheduledToday: 2,
      erasedLast7Days: 2,
    });
  });
});
