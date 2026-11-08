import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { adminDeps, NOW, seedAccount } from "../../test/admin-fixtures";
import { eraseQaAccounts } from "./erase-qa-accounts";

const DOMAIN = "qa.example.test";
const HOUR = 60 * 60 * 1000;

function deps() {
  const base = adminDeps();
  return {
    ...base,
    // Better Auth's deletion runs completeUserErasure, which releases the erasure lease.
    gateway: {
      ...base.gateway,
      async deleteUser(userId: string, operationId?: string) {
        await base.gateway.deleteUser(userId, operationId);
        await env.DB.prepare("DELETE FROM privacy_erasure_lock").run();
      },
    },
    eraseUserArtifacts: async () => {},
    eraseWorkspaceArtifacts: async () => {},
  };
}

async function exists(email: string): Promise<boolean> {
  return (
    (await env.DB.prepare("SELECT 1 AS x FROM user WHERE email = ?")
      .bind(email)
      .first()) !== null
  );
}

const old = new Date(NOW.getTime() - 3 * HOUR);
const young = new Date(NOW.getTime() - HOUR);

describe("eraseQaAccounts", () => {
  it("erases one run's accounts of any age, and nobody else", async () => {
    const run = [`qa+20261028aaaa-a@${DOMAIN}`, `qa+20261028aaaa-b@${DOMAIN}`];
    for (const email of run)
      await seedAccount("Run", { email, createdAt: young });
    await seedAccount("Other run", {
      email: `qa+20261028bbbb-a@${DOMAIN}`,
      createdAt: old,
    });
    const result = await eraseQaAccounts(deps(), {
      domain: DOMAIN,
      runId: "20261028aaaa",
    });
    expect([...result.erased].sort()).toEqual([...run].sort());
    expect(result.remaining).toEqual([]);
    for (const email of run) expect(await exists(email)).toBe(false);
    expect(await exists(`qa+20261028bbbb-a@${DOMAIN}`)).toBe(true);
    const { results } = await env.DB.prepare(
      "SELECT actor_kind AS kind FROM audit_events WHERE action = 'user.deleted'"
    ).all<{ kind: string }>();
    expect(results.map((row) => row.kind)).toEqual(["system", "system"]);
  });

  it("without a run id erases run accounts older than two hours only, never the QA admin or another address", async () => {
    const keep = [
      { email: `qa+20261028cccc-a@${DOMAIN}`, createdAt: young },
      { email: `qa+admin@${DOMAIN}`, createdAt: old },
      { email: `qa+tagged@${DOMAIN}`, createdAt: old },
      { email: `qa@${DOMAIN}`, createdAt: old },
      { email: "qa+20261028dddd-a@other.example.test", createdAt: old },
      { email: "person@example.test", createdAt: old },
    ];
    for (const account of keep) await seedAccount("Keep", account);
    await seedAccount("Leftover", {
      email: `qa+20261028eeee-a@${DOMAIN}`,
      createdAt: old,
    });
    const result = await eraseQaAccounts(deps(), {
      domain: DOMAIN,
      runId: null,
    });
    expect(result.erased).toContain(`qa+20261028eeee-a@${DOMAIN}`);
    for (const account of keep) {
      expect(result.erased).not.toContain(account.email);
      expect(await exists(account.email), account.email).toBe(true);
    }
  });

  it("erases at most a batch per call", async () => {
    for (let index = 0; index < 25; index++) {
      await seedAccount(`Batch ${index}`, {
        email: `qa+20261028ffff-r${index}@${DOMAIN}`,
        createdAt: old,
      });
    }
    const first = await eraseQaAccounts(deps(), {
      domain: DOMAIN,
      runId: "20261028ffff",
    });
    expect(first.erased).toHaveLength(20);
    const second = await eraseQaAccounts(deps(), {
      domain: DOMAIN,
      runId: "20261028ffff",
    });
    expect(second.erased).toHaveLength(5);
  });

  it("refuses a malformed run id", async () => {
    await expect(
      eraseQaAccounts(deps(), { domain: DOMAIN, runId: "%" })
    ).rejects.toMatchObject({ kind: "invalid_input" });
  });
});
