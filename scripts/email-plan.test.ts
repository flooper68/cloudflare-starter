import { describe, expect, it } from "vitest";

import {
  enableOutcome,
  isAlreadyEnabledError,
  listsSendingDomain,
  planEnable,
} from "./email-plan";

const ok = (stdout: string) => ({ ok: true, stdout, stderr: "" });
const failed = (stderr: string) => ({ ok: false, stdout: "", stderr });

describe("listsSendingDomain", () => {
  it("finds the domain in a table row", () => {
    const table = [
      "┌────────────┬─────────┐",
      "│ name       │ enabled │",
      "├────────────┼─────────┤",
      "│ flooper.me │ true    │",
      "└────────────┴─────────┘",
    ].join("\n");
    expect(listsSendingDomain(table, "flooper.me")).toBe(true);
  });

  it("finds the domain in JSON-ish output, case-insensitively", () => {
    expect(listsSendingDomain('{ "name": "Flooper.me" }', "flooper.me")).toBe(
      true
    );
  });

  it("does not match a different subdomain or a longer name", () => {
    expect(listsSendingDomain("│ mail.flooper.me │", "flooper.me")).toBe(false);
    expect(listsSendingDomain("│ flooper.media │", "flooper.me")).toBe(false);
    expect(listsSendingDomain("No sending subdomains.", "flooper.me")).toBe(
      false
    );
  });
});

describe("planEnable", () => {
  it("skips enable when the list names the domain", () => {
    expect(planEnable(ok("│ flooper.me │ true │"), "flooper.me")).toBe(
      "already-enabled"
    );
  });

  it("enables when the domain is missing or the list failed", () => {
    expect(planEnable(ok(""), "flooper.me")).toBe("enable");
    expect(planEnable(failed("│ flooper.me │"), "flooper.me")).toBe("enable");
  });
});

describe("enableOutcome", () => {
  it("is enabled when wrangler succeeds", () => {
    expect(enableOutcome(ok("Enabled"))).toEqual({ status: "enabled" });
  });

  it("treats Subdomain already exists [code 2040] as already enabled", () => {
    expect(
      enableOutcome(
        failed(
          "✘ [ERROR] A request to the Cloudflare API failed.\n  Subdomain already exists [code: 2040]"
        )
      )
    ).toEqual({ status: "already-enabled" });
    expect(isAlreadyEnabledError("Subdomain already exists [code 2040]")).toBe(
      true
    );
  });

  it("fails on any other error, with its message", () => {
    expect(
      enableOutcome(failed("Authentication error [code: 10000]\n"))
    ).toEqual({
      status: "failed",
      message: "Authentication error [code: 10000]",
    });
    expect(isAlreadyEnabledError("code 20400")).toBe(false);
  });
});
