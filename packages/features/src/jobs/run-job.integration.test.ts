import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { fixedClock, sequentialIds, testDb } from "../../test/fixtures";
import { defineJob, type JobEnvelope, type RequestContext } from "../kernel";
import { createMemoryJobQueue, createMemoryLogger } from "../platform";
import { JobLockedError, registerJob } from "./domain";
import { type JobDeps, runJob } from "./run-job";

const job = defineJob({
  type: "billing.send-invoice",
  payload: z.object({ invoiceId: z.string() }),
  backoff: { initialDelaySeconds: 1, maxDelaySeconds: 1, jitter: "none" },
  idempotencyKey: (payload) => payload.invoiceId,
});

function deps(iso = "2026-10-28T12:00:00.000Z"): JobDeps {
  return {
    db: testDb(),
    clock: fixedClock(iso),
    ids: sequentialIds(),
    logger: createMemoryLogger(),
    jobQueue: createMemoryJobQueue(),
    bucket: env.FILES,
  };
}

function envelope(id: string, key?: string): JobEnvelope {
  return {
    specversion: "1.0",
    id,
    source: "/local/http",
    type: job.type,
    time: "2026-10-28T12:00:00.000Z",
    datacontenttype: "application/json",
    data: { invoiceId: "inv-1" },
    ...(key ? { idempotencykey: key } : {}),
  };
}

function runOf(e: JobEnvelope, attempts = 1) {
  return {
    id: e.id,
    type: e.type,
    time: e.time,
    attempts,
    context: {} as RequestContext,
  };
}

async function keyRow(key: string) {
  return env.DB.prepare(
    "SELECT job_id, status, locked_until, expires_at FROM job_idempotency_keys WHERE key = ?"
  )
    .bind(key)
    .first<{
      job_id: string;
      status: string;
      locked_until: number | null;
      expires_at: number;
    }>();
}

describe("runJob (D1 idempotency keys)", () => {
  it("runs a job without a key every time, storing nothing", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const registered = registerJob(job, handle);
    const e = envelope("job-a");
    expect(await runJob(deps(), registered, e, runOf(e))).toBe("completed");
    expect(await runJob(deps(), registered, e, runOf(e))).toBe("completed");
    expect(handle).toHaveBeenCalledTimes(2);
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM job_idempotency_keys"
    ).first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it("runs a keyed job once: done for 7 days, duplicates skipped", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const registered = registerJob(job, handle);
    const first = envelope("job-b1", "key-done");
    const duplicate = envelope("job-b2", "key-done");

    expect(await runJob(deps(), registered, first, runOf(first))).toBe(
      "completed"
    );
    expect(await keyRow("key-done")).toEqual({
      job_id: "job-b1",
      status: "done",
      locked_until: null,
      expires_at: Date.parse("2026-11-04T12:00:00.000Z"),
    });
    expect(await runJob(deps(), registered, duplicate, runOf(duplicate))).toBe(
      "skipped"
    );
    // The same job redelivered after it completed is a duplicate too.
    expect(await runJob(deps(), registered, first, runOf(first, 2))).toBe(
      "skipped"
    );
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("lets a done key be claimed again once it expired", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const registered = registerJob(job, handle);
    const first = envelope("job-c1", "key-expiring");
    const later = envelope("job-c2", "key-expiring");
    await runJob(deps(), registered, first, runOf(first));
    expect(
      await runJob(
        deps("2026-11-04T12:00:00.000Z"),
        registered,
        later,
        runOf(later)
      )
    ).toBe("completed");
    expect((await keyRow("key-expiring"))?.job_id).toBe("job-c2");
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("holds an in-progress key for 15 minutes against other jobs, then reclaims it", async () => {
    const stuck = envelope("job-d1", "key-locked");
    const other = envelope("job-d2", "key-locked");
    // A run that never finishes (its Worker died): the claim stays in progress.
    let release: () => void = () => {};
    const blocking = registerJob(
      job,
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const pending = runJob(deps(), blocking, stuck, runOf(stuck));
    await vi.waitFor(async () =>
      expect((await keyRow("key-locked"))?.status).toBe("in_progress")
    );
    expect((await keyRow("key-locked"))?.locked_until).toBe(
      Date.parse("2026-10-28T12:15:00.000Z")
    );

    const handle = vi.fn().mockResolvedValue(undefined);
    const registered = registerJob(job, handle);
    await expect(
      runJob(deps("2026-10-28T12:14:59.000Z"), registered, other, runOf(other))
    ).rejects.toBeInstanceOf(JobLockedError);
    expect(handle).not.toHaveBeenCalled();

    expect(
      await runJob(
        deps("2026-10-28T12:15:00.000Z"),
        registered,
        other,
        runOf(other)
      )
    ).toBe("completed");
    expect(await keyRow("key-locked")).toMatchObject({
      job_id: "job-d2",
      status: "done",
    });
    release();
    await pending;
  });

  it("lets a redelivery of the same job reclaim its own in-progress key at once", async () => {
    const e = envelope("job-e1", "key-redelivered");
    await env.DB.prepare(
      "INSERT INTO job_idempotency_keys (key, job_type, job_id, status, locked_until, expires_at) VALUES (?, ?, ?, 'in_progress', ?, ?)"
    )
      .bind(
        "key-redelivered",
        job.type,
        "job-e1",
        Date.parse("2026-10-28T12:10:00.000Z"),
        Date.parse("2026-11-04T11:55:00.000Z")
      )
      .run();
    const handle = vi.fn().mockResolvedValue(undefined);
    expect(await runJob(deps(), registerJob(job, handle), e, runOf(e, 2))).toBe(
      "completed"
    );
    expect(handle).toHaveBeenCalledOnce();
  });

  it("releases the claim when the handler fails, so the retry can run", async () => {
    const e = envelope("job-f1", "key-failing");
    const failing = registerJob(job, async () => {
      throw new Error("payment provider down");
    });
    await expect(runJob(deps(), failing, e, runOf(e))).rejects.toThrow(
      "payment provider down"
    );
    expect(await keyRow("key-failing")).toBeNull();

    const handle = vi.fn().mockResolvedValue(undefined);
    expect(await runJob(deps(), registerJob(job, handle), e, runOf(e, 2))).toBe(
      "completed"
    );
  });
});
