import { describe, expect, it } from "vitest";

import { redactUrlPath } from "./redact-url";

describe("redactUrlPath", () => {
  it.each([
    [
      "/api/auth/reset-password/tok_9f8e7d6c",
      "/api/auth/reset-password/[redacted]",
    ],
    ["/invite/inv_123abc", "/invite/[redacted]"],
    [
      "/app/invitations/inv_123abc/accept",
      "/app/invitations/[redacted]/accept",
    ],
    ["/api/auth/verify-email/abc", "/api/auth/verify-email/[redacted]"],
    [
      "/api/auth/verify-email?token=abc&callbackURL=%2Fapp",
      "/api/auth/verify-email?token=[redacted]&callbackURL=%2Fapp",
    ],
    [
      "/api/auth/reset-password/tok_1?callbackURL=%2Freset-password",
      "/api/auth/reset-password/[redacted]?callbackURL=%2Freset-password",
    ],
    ["/callback?code=xyz&state=s", "/callback?code=[redacted]&state=s"],
  ])("redacts the secret in %s", (input, expected) => {
    expect(redactUrlPath(input)).toBe(expected);
    expect(redactUrlPath(input)).not.toMatch(/tok_|inv_|=abc|=xyz/);
  });

  it.each([
    "/api/hello",
    "/api/files/8f14e45f-ceea-467a-9575-0f4c5e9b2c11",
    "/reset-password",
    "/invite/",
    "/app/dashboard?tab=files",
  ])("leaves %s alone", (path) => {
    expect(redactUrlPath(path)).toBe(path);
  });
});
