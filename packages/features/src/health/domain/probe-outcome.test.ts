import { describe, expect, it } from "vitest";

import { bindingsOutcome, emailOutcome } from "./probe-outcome";

describe("bindingsOutcome", () => {
  it("passes when every binding is present, or none is required", () => {
    expect(bindingsOutcome({ APP_QUEUE: {} })).toEqual({ status: "pass" });
    expect(bindingsOutcome({})).toEqual({ status: "pass" });
  });

  it("fails naming the missing bindings only in the detail", () => {
    expect(
      bindingsOutcome({ RL_UPLOAD: undefined, RL_AUTH_IP: null, RL_MCP_IP: {} })
    ).toEqual({
      status: "fail",
      output: "missing binding",
      detail: "not bound: RL_AUTH_IP, RL_UPLOAD",
    });
  });
});

describe("emailOutcome", () => {
  it("passes when mail is configured", () => {
    expect(
      emailOutcome({ configured: true, verificationRequired: true })
    ).toEqual({ status: "pass" });
  });

  it("warns without mail: the app serves, minus mail", () => {
    expect(
      emailOutcome({ configured: false, verificationRequired: false })
    ).toMatchObject({ status: "warn", output: "not configured" });
  });

  it("fails without mail when sign-up needs email verification", () => {
    expect(
      emailOutcome({ configured: false, verificationRequired: true })
    ).toMatchObject({ status: "fail", output: "not configured" });
  });
});
