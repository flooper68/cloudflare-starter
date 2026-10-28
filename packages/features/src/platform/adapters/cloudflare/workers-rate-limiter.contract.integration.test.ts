import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { describeRateLimiterContract } from "../../ports/rate-limiter.contract";
import { createCloudflareRateLimiter } from "./workers-rate-limiter";

// The RL_TEST binding (packages/features/test/wrangler.jsonc: 3 per 10 s) is simulated
// by Miniflare, so this runs the real binding API locally.
const rule = { limit: 3, periodSeconds: 10, binding: "RL_TEST" };

describeRateLimiterContract(
  "cloudflare (Workers Rate Limiting binding)",
  () => ({
    limiter: createCloudflareRateLimiter({ RL_TEST: env.RL_TEST }),
    rule,
    enforces: true,
  })
);

describe("cloudflare rate limiter", () => {
  it("fails loudly when the rule's binding is missing", async () => {
    const limiter = createCloudflareRateLimiter({});
    await expect(limiter.limit(rule, "k")).rejects.toThrow(
      "Missing Workers Rate Limiting binding RL_TEST"
    );
  });
});
