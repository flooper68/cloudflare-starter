import { describe, expect, it } from "vitest";

import { findSecretKeys } from "./redact";

describe("findSecretKeys", () => {
  it("accepts plain metadata", () => {
    expect(
      findSecretKeys({
        method: "password",
        reason: "INVALID_EMAIL_OR_PASSWORD",
      })
    ).toEqual([]);
  });

  it.each([
    "token",
    "accessToken",
    "password",
    "newPassword",
    "secret",
    "clientSecret",
    "code",
    "otpCode",
  ])("finds %s", (key) => {
    expect(findSecretKeys({ [key]: "x" })).toEqual([key]);
  });

  it("finds keys at any depth, in objects and arrays", () => {
    expect(
      findSecretKeys({
        method: "social",
        nested: { refresh_token: "x", list: [{ apiSecret: "y" }] },
      })
    ).toEqual(["nested.refresh_token", "nested.list[0].apiSecret"]);
  });

  it("ignores values, only keys count", () => {
    expect(findSecretKeys({ reason: "password too short" })).toEqual([]);
    expect(findSecretKeys("token")).toEqual([]);
    expect(findSecretKeys(null)).toEqual([]);
  });
});
