import { describe, expect, it, vi } from "vitest";

import { createMemoryRateLimiter } from "../platform";
import { checkQaBypass } from "./check-qa-bypass";
import {
  type QaBypassRejection,
  RATE_LIMIT_POLICIES,
  RateLimitedError,
} from "./domain";

// The real comparison, observed: the use case must compare tokens with it.
vi.mock("./domain/timing-safe-equal", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./domain/timing-safe-equal")>();
  return { timingSafeEqual: vi.fn(original.timingSafeEqual) };
});
const { timingSafeEqual } = await import("./domain/timing-safe-equal");

const TOKEN = "qa-test-token-0123456789abcdefghijklmnop";
const bypass = { token: TOKEN, emailDomain: "qa.example.com" };
const clock = { now: () => new Date("2026-11-08T12:00:05Z") };

function harness() {
  const accepted: true[] = [];
  const rejected: QaBypassRejection[] = [];
  return {
    accepted,
    rejected,
    deps: {
      rateLimiter: createMemoryRateLimiter(clock),
      onAccepted: async () => {
        accepted.push(true);
      },
      onRejected: (reason: QaBypassRejection) => {
        rejected.push(reason);
      },
    },
  };
}

const request = {
  bypass,
  presentedToken: TOKEN,
  email: "qa-run-owner@qa.example.com",
  ip: "203.0.113.50",
};

describe("checkQaBypass", () => {
  it("ignores the header entirely with QA_BYPASS=off", async () => {
    const { deps, accepted, rejected } = harness();
    const limit = vi.spyOn(deps.rateLimiter, "limit");
    await expect(
      checkQaBypass(deps, { ...request, bypass: null })
    ).resolves.toBe(false);
    expect(limit).not.toHaveBeenCalled();
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("does nothing for a request without the header", async () => {
    const { deps, accepted, rejected } = harness();
    const limit = vi.spyOn(deps.rateLimiter, "limit");
    await expect(
      checkQaBypass(deps, { ...request, presentedToken: null })
    ).resolves.toBe(false);
    expect(limit).not.toHaveBeenCalled();
    expect([...accepted, ...rejected]).toEqual([]);
  });

  it("accepts the right token for an address in the QA domain, once audited", async () => {
    const { deps, accepted, rejected } = harness();
    await expect(checkQaBypass(deps, request)).resolves.toBe(true);
    expect(accepted).toEqual([true]);
    expect(rejected).toEqual([]);
  });

  it("falls back to the human check for a wrong token", async () => {
    const { deps, accepted, rejected } = harness();
    await expect(
      checkQaBypass(deps, { ...request, presentedToken: `${TOKEN}x` })
    ).resolves.toBe(false);
    expect(rejected).toEqual(["wrong_token"]);
    expect(accepted).toEqual([]);
  });

  it("falls back to the human check for an address outside the QA domain, even with the right token", async () => {
    const { deps, accepted, rejected } = harness();
    for (const email of ["someone@example.com", "a@x.qa.example.com", null]) {
      await expect(checkQaBypass(deps, { ...request, email })).resolves.toBe(
        false
      );
    }
    expect(rejected).toEqual(["wrong_domain", "wrong_domain", "wrong_domain"]);
    expect(accepted).toEqual([]);
  });

  it("compares the token in constant time", async () => {
    vi.mocked(timingSafeEqual).mockClear();
    const { deps } = harness();
    await checkQaBypass(deps, { ...request, presentedToken: "guess" });
    expect(timingSafeEqual).toHaveBeenCalledWith("guess", TOKEN);
  });

  it("counts every request with the header against qa.bypass before comparing, and refuses over the limit", async () => {
    const { deps, accepted } = harness();
    const { limit } = RATE_LIMIT_POLICIES["qa.bypass"];
    for (let call = 0; call < limit; call++) {
      await checkQaBypass(deps, { ...request, presentedToken: "guess" });
    }
    vi.mocked(timingSafeEqual).mockClear();
    const refused = checkQaBypass(deps, request);
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    await expect(refused).rejects.toMatchObject({ policy: "qa.bypass" });
    expect(timingSafeEqual).not.toHaveBeenCalled();
    expect(accepted).toEqual([]);
    // Another IP has its own counter.
    await expect(
      checkQaBypass(deps, { ...request, ip: "203.0.113.51" })
    ).resolves.toBe(true);
  });
});
