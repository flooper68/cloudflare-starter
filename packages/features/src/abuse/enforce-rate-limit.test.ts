import { describe, expect, it } from "vitest";

import { createMemoryRateLimiter, type RateLimitRule } from "../platform";
import { RateLimitedError } from "./domain";
import { enforceRateLimit } from "./enforce-rate-limit";

const clock = { now: () => new Date("2026-10-28T12:00:20Z") };
const subject = { userId: "user-1", ip: "203.0.113.7" };

describe("enforceRateLimit", () => {
  it("lets requests through up to the policy's limit, then throws RateLimitedError", async () => {
    const deps = { rateLimiter: createMemoryRateLimiter(clock) };
    // invitation.send allows 10 a minute.
    for (let call = 0; call < 10; call++) {
      await enforceRateLimit(deps, { policy: "invitation.send", subject });
    }
    const refused = enforceRateLimit(deps, {
      policy: "invitation.send",
      subject,
    });
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({
      policy: "invitation.send",
      retryAfterSeconds: 40,
    });
  });

  it("asks the limiter with the catalog rule and the subject's key", async () => {
    const seen: [RateLimitRule, string][] = [];
    await enforceRateLimit(
      {
        rateLimiter: {
          limit: async (rule, key) => {
            seen.push([rule, key]);
            return { ok: true };
          },
        },
      },
      { policy: "upload.user", subject }
    );
    expect(seen).toEqual([
      [
        expect.objectContaining({
          limit: 20,
          periodSeconds: 60,
          binding: "RL_UPLOAD",
        }),
        "upload.user:user:user-1",
      ],
    ]);
  });
});
