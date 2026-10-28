import { describe, expect, it } from "vitest";

import {
  rateLimitedHeaders,
  rateLimitPolicyHeader,
} from "./rate-limit-headers";

describe("RateLimit header fields", () => {
  it("lists each policy once as a Structured Field item with quota and window", () => {
    expect(rateLimitPolicyHeader(["auth.ip", "auth.sign-in", "auth.ip"])).toBe(
      '"auth.ip";q=60;w=60, "auth.sign-in";q=10;w=60'
    );
  });

  it("gives a refusal Retry-After, the policy and r=0 for the wait", () => {
    expect(rateLimitedHeaders("upload.user", 42)).toEqual({
      "Retry-After": "42",
      "RateLimit-Policy": '"upload.user";q=20;w=60',
      RateLimit: '"upload.user";r=0;t=42',
    });
  });
});
