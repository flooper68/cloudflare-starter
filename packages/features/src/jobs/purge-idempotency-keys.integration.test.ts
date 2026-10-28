import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { fixedClock, testDb } from "../../test/fixtures";
import { purgeIdempotencyKeys } from "./purge-idempotency-keys";

async function insertKey(key: string, status: string, expiresAt: string) {
  await env.DB.prepare(
    "INSERT INTO job_idempotency_keys (key, job_type, job_id, status, locked_until, expires_at) VALUES (?, 'billing.send-invoice', ?, ?, NULL, ?)"
  )
    .bind(key, `job-${key}`, status, Date.parse(expiresAt))
    .run();
}

describe("purgeIdempotencyKeys", () => {
  it("deletes keys at or past their expiry and keeps the rest", async () => {
    await insertKey("expired-done", "done", "2026-10-20T00:00:00.000Z");
    await insertKey("expired-stuck", "in_progress", "2026-10-28T12:00:00.000Z");
    await insertKey("fresh", "done", "2026-11-01T00:00:00.000Z");

    expect(
      await purgeIdempotencyKeys({ db: testDb(), clock: fixedClock() })
    ).toEqual({ deleted: 2 });

    const { results } = await env.DB.prepare(
      "SELECT key FROM job_idempotency_keys ORDER BY key"
    ).all<{ key: string }>();
    expect(results.map((row) => row.key)).toEqual(["fresh"]);
    expect(
      await purgeIdempotencyKeys({ db: testDb(), clock: fixedClock() })
    ).toEqual({ deleted: 0 });
  });
});
