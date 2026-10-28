import { describe, expect, it } from "vitest";

import { DomainError } from "../../kernel";
import {
  HumanCheckFailedError,
  HumanCheckUnavailableError,
  RateLimitedError,
} from "./errors";

describe("abuse errors", () => {
  it("RateLimitedError is rate_limited with code RATE_LIMITED, the policy and the wait", () => {
    const error = new RateLimitedError("mutation.user", 60);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.kind).toBe("rate_limited");
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.policy).toBe("mutation.user");
    expect(error.retryAfterSeconds).toBe(60);
    expect(error.message).toBe("Too many requests. Try again in 60 seconds.");
  });

  it("a failed human check is invalid input; an unavailable one is unavailable", () => {
    expect(new HumanCheckFailedError()).toMatchObject({
      kind: "invalid_input",
      code: "HUMAN_CHECK_FAILED",
    });
    expect(new HumanCheckUnavailableError()).toMatchObject({
      kind: "unavailable",
      code: "HUMAN_CHECK_UNAVAILABLE",
    });
  });
});
