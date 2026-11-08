import { beforeEach, describe, expect, it } from "vitest";

import {
  DAY,
  DEMO_NOW,
  daysBefore,
  demoOn,
  markWarned,
  resetDemoState,
  retentionDeps,
  seedDemoUser,
  userExists,
} from "../../test/demo-fixtures";
import {
  addMember,
  notificationsSent,
  rows,
  seedWorkspace,
} from "../../test/fixtures";
import { DEMO_ERASE_BATCH } from "./domain";
import { enforceDemoRetention } from "./enforce-demo-retention";
import { warnDemoAccount } from "./warn-demo-account";

const asOf = new Date(DEMO_NOW);

function enqueued(deps: ReturnType<typeof retentionDeps>, type: string) {
  return deps.jobQueue.sent
    .filter((sent) => sent.envelope.type === type)
    .map((sent) => sent.envelope.data);
}

describe("enforceDemoRetention", () => {
  beforeEach(resetDemoState);

  it("does nothing with DEMO_MODE=off", async () => {
    const old = await seedDemoUser("off@example.test", daysBefore(30));
    const deps = retentionDeps(DEMO_NOW, { mode: "off" });
    expect(await enforceDemoRetention(deps, { asOf, batch: 0 })).toEqual({
      status: "off",
    });
    expect(await userExists(old.id)).toBe(true);
    expect(deps.jobQueue.sent).toEqual([]);
  });

  it("erases only expired, warned, non-exempt accounts and warns the ones due", async () => {
    const young = await seedDemoUser("young@example.test", daysBefore(3));
    const lastDay = await seedDemoUser("lastday@example.test", daysBefore(6.5));
    const unwarned = await seedDemoUser(
      "unwarned@example.test",
      daysBefore(10)
    );
    const warned = await seedDemoUser("warned@example.test", daysBefore(10));
    await markWarned(warned.id, new Date(asOf.getTime() - DAY + 5000));
    const justWarned = await seedDemoUser(
      "justwarned@example.test",
      daysBefore(8)
    );
    await markWarned(justWarned.id, new Date(asOf.getTime() - 60 * 60 * 1000));
    const exempt = [
      await seedDemoUser("admin@example.test", daysBefore(30), {
        role: "admin",
      }),
      await seedDemoUser("Founder@Flooper.test", daysBefore(30)),
      await seedDemoUser("owner@flooper.test", daysBefore(30)),
      await seedDemoUser("qa+run-owner@qa.flooper.test", daysBefore(30)),
    ];
    for (const account of exempt) await markWarned(account.id, daysBefore(2));

    const deps = retentionDeps();
    const result = await enforceDemoRetention(deps, { asOf, batch: 0 });

    expect(result).toEqual({
      status: "done",
      warned: 2,
      erased: 1,
      blocked: 0,
      failed: 0,
      continued: false,
    });
    expect(await userExists(warned.id)).toBe(false);
    for (const kept of [young, lastDay, unwarned, justWarned, ...exempt])
      expect(await userExists(kept.id)).toBe(true);
    // Its personal workspace went with it, through the privacy erasure.
    expect(
      await rows("SELECT id FROM workspaces WHERE id = ?", warned.workspaceId)
    ).toEqual([]);
    expect(
      await rows(
        "SELECT action, actor_kind, metadata FROM audit_events WHERE target_id = ? AND action IN ('demo.account_erased', 'privacy.user_erased') ORDER BY action",
        warned.id
      )
    ).toEqual([
      {
        action: "demo.account_erased",
        actor_kind: "system",
        metadata: JSON.stringify({ retentionDays: 7 }),
      },
      { action: "privacy.user_erased", actor_kind: "system", metadata: "{}" },
    ]);
    // Warnings for the account in its last day and the expired one never warned.
    expect(enqueued(deps, "demo.warn-account")).toEqual([
      { userId: unwarned.id, asOf: DEMO_NOW },
      { userId: lastDay.id, asOf: DEMO_NOW },
    ]);
  });

  it("warns once, then erases on the next day's run", async () => {
    const visitor = await seedDemoUser("visitor@example.test", daysBefore(6.5));
    const day1 = retentionDeps();
    await enforceDemoRetention(day1, { asOf, batch: 0 });
    const [job] = enqueued(day1, "demo.warn-account") as {
      userId: string;
      asOf: string;
    }[];
    expect(job?.userId).toBe(visitor.id);

    // The warning job runs, then is delivered again: one notification.
    const warnDeps = { ...day1, notify: day1.notify };
    expect(
      (await warnDemoAccount(warnDeps, { userId: visitor.id, asOf })).status
    ).toBe("sent");
    expect(
      await warnDemoAccount(warnDeps, { userId: visitor.id, asOf })
    ).toEqual({ status: "skipped", reason: "already_warned" });
    expect(notificationsSent(day1.jobQueue)).toEqual([
      expect.objectContaining({
        type: "demo.deletion-warning",
        recipients: [visitor.id],
      }),
    ]);

    // A second run the same day neither warns again nor erases.
    const again = retentionDeps();
    expect(await enforceDemoRetention(again, { asOf, batch: 0 })).toMatchObject(
      {
        warned: 0,
        erased: 0,
      }
    );

    const tomorrow = new Date(asOf.getTime() + DAY);
    const day2 = retentionDeps(tomorrow.toISOString());
    expect(
      await enforceDemoRetention(day2, { asOf: tomorrow, batch: 0 })
    ).toMatchObject({ warned: 0, erased: 1 });
    expect(await userExists(visitor.id)).toBe(false);
  });

  it("caps each batch and continues with the next one", async () => {
    const accounts = [];
    for (let i = 0; i < DEMO_ERASE_BATCH + 3; i++) {
      const account = await seedDemoUser(
        `batch-${String(i).padStart(2, "0")}@example.test`,
        new Date(daysBefore(9).getTime() + i * 1000)
      );
      await markWarned(account.id, daysBefore(1));
      accounts.push(account);
    }
    const first = retentionDeps();
    expect(await enforceDemoRetention(first, { asOf, batch: 0 })).toMatchObject(
      {
        erased: DEMO_ERASE_BATCH,
        continued: true,
      }
    );
    expect(enqueued(first, "demo.enforce-retention")).toEqual([
      { asOf: DEMO_NOW, batch: 1, skip: 0 },
    ]);
    // Oldest first.
    expect(await userExists(accounts[0]?.id ?? "")).toBe(false);
    expect(await userExists(accounts.at(-1)?.id ?? "")).toBe(true);

    const second = retentionDeps();
    expect(
      await enforceDemoRetention(second, { asOf, batch: 1, skip: 0 })
    ).toMatchObject({ erased: 3, warned: 0, continued: false });
    for (const account of accounts)
      expect(await userExists(account.id)).toBe(false);
  });

  it("stops after DEMO_MAX_BATCHES_PER_RUN batches", async () => {
    for (let i = 0; i < DEMO_ERASE_BATCH + 1; i++) {
      const account = await seedDemoUser(
        `max-${i}@example.test`,
        daysBefore(9)
      );
      await markWarned(account.id, daysBefore(1));
    }
    const last = retentionDeps();
    expect(await enforceDemoRetention(last, { asOf, batch: 4 })).toMatchObject({
      erased: DEMO_ERASE_BATCH,
      continued: false,
    });
    expect(enqueued(last, "demo.enforce-retention")).toEqual([]);
  });

  it("counts a last owner of a workspace others use as blocked, keeps it, and goes on", async () => {
    const owner = await seedDemoUser("blocked@example.test", daysBefore(20));
    await markWarned(owner.id, daysBefore(1));
    const colleague = await seedDemoUser(
      "colleague@example.test",
      daysBefore(1)
    );
    const shared = await seedWorkspace(owner.id, { id: "ws-shared-blocked" });
    await addMember(shared.workspaceId, colleague.id, "member");
    const next = await seedDemoUser("next@example.test", daysBefore(15));
    await markWarned(next.id, daysBefore(1));

    const deps = retentionDeps();
    expect(await enforceDemoRetention(deps, { asOf, batch: 0 })).toMatchObject({
      erased: 1,
      blocked: 1,
      failed: 0,
    });
    expect(await userExists(owner.id)).toBe(true);
    expect(await userExists(next.id)).toBe(false);
    // Nothing of the blocked account was touched.
    expect(
      await rows(
        "SELECT id FROM workspaces WHERE id IN (?, ?)",
        owner.workspaceId,
        shared.workspaceId
      )
    ).toHaveLength(2);
    expect(deps.logger.records).toContainEqual(
      expect.objectContaining({ body: "demo.erasure_blocked" })
    );
  });

  it("deletes a shared workspace the account was the only member of", async () => {
    const solo = await seedDemoUser("solo@example.test", daysBefore(20));
    await markWarned(solo.id, daysBefore(1));
    const shared = await seedWorkspace(solo.id, { id: "ws-shared-solo" });
    const deps = retentionDeps();
    await enforceDemoRetention(deps, { asOf, batch: 0 });
    expect(await userExists(solo.id)).toBe(false);
    expect(
      await rows("SELECT id FROM workspaces WHERE id = ?", shared.workspaceId)
    ).toEqual([]);
  });

  it("reads the policy it runs with: a longer retention keeps the account", async () => {
    const visitor = await seedDemoUser("policy@example.test", daysBefore(10));
    await markWarned(visitor.id, daysBefore(1));
    const deps = retentionDeps(
      DEMO_NOW,
      demoOn({
        policy: {
          retentionDays: 30,
          protectedEmails: [],
          bootstrapAdminEmail: null,
          qaEmailDomain: null,
        },
      })
    );
    expect(await enforceDemoRetention(deps, { asOf, batch: 0 })).toMatchObject({
      erased: 0,
    });
    expect(await userExists(visitor.id)).toBe(true);
  });
});
