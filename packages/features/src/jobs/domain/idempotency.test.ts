import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineJob } from "../../kernel";
import { claimWindow, completedExpiry, idempotencyKeyFor } from "./idempotency";

const now = new Date("2026-10-28T12:00:00.000Z");
const backoff = {
  initialDelaySeconds: 1,
  maxDelaySeconds: 1,
  jitter: "none",
} as const;

describe("idempotency", () => {
  it("locks a claim for 15 minutes and keeps it 7 days", () => {
    expect(claimWindow(now)).toEqual({
      lockedUntil: new Date("2026-10-28T12:15:00.000Z"),
      expiresAt: new Date("2026-11-04T12:00:00.000Z"),
    });
  });

  it("keeps a completed key 7 days from completion", () => {
    expect(completedExpiry(now)).toEqual(new Date("2026-11-04T12:00:00.000Z"));
  });

  it("prefixes the job's key with its type, and has none without a key function", () => {
    const keyed = defineJob({
      type: "billing.send-invoice",
      payload: z.object({ invoiceId: z.string() }),
      backoff,
      idempotencyKey: (payload) => `invoice-${payload.invoiceId}`,
    });
    const unkeyed = defineJob({
      type: "greetings.hello",
      payload: z.object({ name: z.string() }),
      backoff,
    });
    expect(idempotencyKeyFor(keyed, { invoiceId: "42" })).toBe(
      "billing.send-invoice:invoice-42"
    );
    expect(idempotencyKeyFor(unkeyed, { name: "Nicole" })).toBeUndefined();
  });
});
