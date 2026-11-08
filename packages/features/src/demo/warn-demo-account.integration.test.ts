import { beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_NOW,
  daysBefore,
  demoOn,
  resetDemoState,
  seedDemoUser,
} from "../../test/demo-fixtures";
import {
  notificationsSent,
  useCaseDeps,
  userAuditTrail,
} from "../../test/fixtures";
import { warnDemoAccount } from "./warn-demo-account";

const asOf = new Date(DEMO_NOW);

function deps(demo = demoOn()) {
  return { ...useCaseDeps(DEMO_NOW), demo };
}

describe("warnDemoAccount", () => {
  beforeEach(resetDemoState);

  it("sends the security-critical warning once and records it", async () => {
    const visitor = await seedDemoUser("visitor@example.test", daysBefore(6.5));
    const first = deps();
    expect(await warnDemoAccount(first, { userId: visitor.id, asOf })).toEqual({
      status: "sent",
      deletesAt: "2026-11-09T03:17:00.000Z",
    });
    expect(notificationsSent(first.jobQueue)).toEqual([
      {
        type: "demo.deletion-warning",
        recipients: [visitor.id],
        data: { deletesAt: "2026-11-09T03:17:00.000Z" },
        workspaceId: null,
      },
    ]);
    expect(await userAuditTrail(visitor.id)).toEqual([
      {
        action: "demo.deletion_warned",
        actor: null,
        metadata: { deletesAt: "2026-11-09T03:17:00.000Z" },
      },
    ]);

    // Delivered again (or enqueued by another run): nothing more is sent.
    const second = deps();
    expect(await warnDemoAccount(second, { userId: visitor.id, asOf })).toEqual(
      { status: "skipped", reason: "already_warned" }
    );
    expect(notificationsSent(second.jobQueue)).toEqual([]);
  });

  it("names a deletion at least a day away for an account already past the retention", async () => {
    const late = await seedDemoUser("late@example.test", daysBefore(30));
    expect(await warnDemoAccount(deps(), { userId: late.id, asOf })).toEqual({
      status: "sent",
      deletesAt: "2026-11-09T03:17:00.000Z",
    });
  });

  it("skips exempt, young and deleted accounts, and everything with demo mode off", async () => {
    const qa = await seedDemoUser("qa+run@qa.flooper.test", daysBefore(6.5));
    const admin = await seedDemoUser("root@example.test", daysBefore(6.5), {
      role: "admin",
    });
    const young = await seedDemoUser("young@example.test", daysBefore(2));
    const d = deps();
    expect(await warnDemoAccount(d, { userId: qa.id, asOf })).toEqual({
      status: "skipped",
      reason: "exempt",
    });
    expect(await warnDemoAccount(d, { userId: admin.id, asOf })).toEqual({
      status: "skipped",
      reason: "exempt",
    });
    expect(await warnDemoAccount(d, { userId: young.id, asOf })).toEqual({
      status: "skipped",
      reason: "not_due",
    });
    expect(await warnDemoAccount(d, { userId: "user-gone", asOf })).toEqual({
      status: "skipped",
      reason: "gone",
    });
    expect(
      await warnDemoAccount(deps({ mode: "off" }), { userId: young.id, asOf })
    ).toEqual({ status: "skipped", reason: "demo_off" });
    expect(notificationsSent(d.jobQueue)).toEqual([]);
  });

  it("throws (so the job retries) and records nothing when the notification cannot be queued", async () => {
    const visitor = await seedDemoUser("retry@example.test", daysBefore(6.5));
    const failing = {
      ...deps(),
      notify: async () => ({ status: "failed" as const, reference: "trace-1" }),
    };
    await expect(
      warnDemoAccount(failing, { userId: visitor.id, asOf })
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(await userAuditTrail(visitor.id)).toEqual([]);
  });
});
