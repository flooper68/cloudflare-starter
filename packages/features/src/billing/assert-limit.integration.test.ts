import { describe, expect, it } from "vitest";

import {
  addMember,
  billingDeps,
  invite,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { assertLimit } from "./assert-limit";
import { LimitReachedError } from "./domain";
import { recordUsage } from "./record-usage";
import { setOverride } from "./set-override";

describe("assertLimit", () => {
  it("counts members and pending invitations as seats: below, at and past the limit", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-seats" });
    await addMember(actor.workspaceId, colleague.id);
    const deps = billingDeps();

    // Free plan: 3 seats. Two members: one more fits.
    await expect(
      assertLimit(deps, actor.workspaceId, "seats", 1)
    ).resolves.toBeUndefined();
    await invite(actor, "alan@example.test");
    // Three seats used (one pending invitation): at the limit, nothing more.
    await expect(
      assertLimit(deps, actor.workspaceId, "seats", 0)
    ).resolves.toBeUndefined();
    await expect(
      assertLimit(deps, actor.workspaceId, "seats", 1)
    ).rejects.toMatchObject({
      kind: "limit_reached",
      details: {
        metric: "seats",
        limit: 3,
        current: 3,
        increment: 1,
        upgrade: { planIds: ["pro"], addonIds: ["extra_seats"] },
      },
    });
  });

  it("ignores expired invitations", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-expired" });
    await invite(actor, "a@example.test", "member", {
      at: "2026-09-01T00:00:00.000Z",
    });
    await invite(actor, "b@example.test", "member", {
      at: "2026-09-01T00:00:00.000Z",
    });
    await expect(
      assertLimit(billingDeps(), actor.workspaceId, "seats", 2)
    ).resolves.toBeUndefined();
  });

  it("checks a period metric against this period's counter", async () => {
    const owner = await seedUser("Mary Jackson");
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-uploads" });
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "files.uploads_per_month",
        override: { kind: "limit", limit: 2 },
        reason: "Small test quota",
      }
    );
    await recordUsage(
      billingDeps(),
      actor.workspaceId,
      "files.uploads_per_month",
      2
    );
    await expect(
      assertLimit(
        billingDeps(),
        actor.workspaceId,
        "files.uploads_per_month",
        1
      )
    ).rejects.toBeInstanceOf(LimitReachedError);
    // A new month starts a new counter.
    await expect(
      assertLimit(
        billingDeps("manual", "2026-11-01T00:00:00.000Z"),
        actor.workspaceId,
        "files.uploads_per_month",
        1
      )
    ).resolves.toBeUndefined();
  });

  it("passes unlimited metrics and everything with billing off", async () => {
    const owner = await seedUser("Katherine Johnson");
    const admin = await seedUser("Barbara Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-unlimited" });
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "storage_bytes",
        override: { kind: "limit", limit: null },
        reason: "Archive customer",
      }
    );
    await expect(
      assertLimit(billingDeps(), actor.workspaceId, "storage_bytes", 10 ** 12)
    ).resolves.toBeUndefined();
    await expect(
      assertLimit(billingDeps("off"), actor.workspaceId, "seats", 1000)
    ).resolves.toBeUndefined();
    await expect(
      assertLimit(billingDeps("off"), actor.workspaceId, "bandwidth", 1)
    ).rejects.toThrow(/Unknown billing metric/);
  });
});
