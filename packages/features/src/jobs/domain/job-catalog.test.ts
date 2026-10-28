import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineJob, type RequestContext } from "../../kernel";
import { InvalidJobPayloadError, UnknownJobTypeError } from "./errors";
import { createJobCatalog, findJob, registerJob } from "./job-catalog";
import { purgeIdempotencyKeysJob } from "./purge-idempotency-keys-job";

const backoff = {
  initialDelaySeconds: 1,
  maxDelaySeconds: 1,
  jitter: "none",
} as const;
const greet = defineJob({
  type: "greetings.hello",
  payload: z.object({ name: z.string().trim().min(1) }),
  backoff,
});
const run = {
  id: "job-1",
  type: "greetings.hello",
  time: "2026-10-28T12:00:00.000Z",
  attempts: 1,
  context: {} as RequestContext,
};

describe("job catalog", () => {
  it("runs the handler with the parsed payload", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const job = registerJob(greet, handle);
    await job.run({ dep: 1 }, { name: " Nicole " }, run);
    expect(handle).toHaveBeenCalledWith({ dep: 1 }, { name: "Nicole" }, run);
    expect(job).toMatchObject({ type: "greetings.hello", backoff });
  });

  it("refuses a payload that does not match, without running the handler", async () => {
    const handle = vi.fn();
    const job = registerJob(greet, handle);
    await expect(job.run({}, { name: "" }, run)).rejects.toBeInstanceOf(
      InvalidJobPayloadError
    );
    expect(handle).not.toHaveBeenCalled();
  });

  it("finds jobs by type and refuses unknown types as permanent", () => {
    const catalog = createJobCatalog([
      registerJob(greet, async () => {}),
      registerJob(purgeIdempotencyKeysJob, async () => {}),
    ]);
    expect(findJob(catalog, "jobs.purge-idempotency-keys").type).toBe(
      "jobs.purge-idempotency-keys"
    );
    expect(() => findJob(catalog, "greetings.bye")).toThrow(
      UnknownJobTypeError
    );
  });

  it("refuses a duplicate or malformed type", () => {
    const job = registerJob(greet, async () => {});
    expect(() => createJobCatalog([job, job])).toThrow(/registered twice/);
    expect(() =>
      createJobCatalog([
        registerJob(defineJob({ ...greet, type: "hello" }), async () => {}),
      ])
    ).toThrow(/<feature>\.<job>/);
  });
});
