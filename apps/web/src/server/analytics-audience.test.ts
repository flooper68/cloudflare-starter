import { describe, expect, it } from "vitest";

import type { AppEnv } from "@/server/env";

import { isExcludedFromAnalytics } from "./analytics-audience";

const env = {
  BOOTSTRAP_ADMIN_EMAIL: "Owner@Example.test",
  QA_EMAIL_DOMAIN: "qa.flooper.me",
  DEMO_PROTECTED_EMAILS: " keep@example.test , Second@Example.test ",
} as unknown as AppEnv;

const excluded = (email: string | null, impersonated = false) =>
  isExcludedFromAnalytics(env, { email, impersonated });

describe("isExcludedFromAnalytics", () => {
  it("leaves out the bootstrap admin, whatever the case", () => {
    expect(excluded("owner@example.test")).toBe(true);
    expect(excluded("OWNER@EXAMPLE.TEST")).toBe(true);
  });

  it("leaves out a session an admin is impersonating", () => {
    expect(excluded("grace@example.test", true)).toBe(true);
  });

  it("counts an ordinary person, and an anonymous caller", () => {
    expect(excluded("grace@example.test")).toBe(false);
    expect(excluded(null)).toBe(false);
  });

  it("leaves out the QA suite's accounts, not a look-alike domain", () => {
    expect(excluded("qa+run1-a@qa.flooper.me")).toBe(true);
    expect(excluded("x@notqa.flooper.me")).toBe(false);
    expect(excluded("x@qa.flooper.me.example.test")).toBe(false);
  });

  it("leaves out demo mode's protected accounts, from a list with spaces", () => {
    expect(excluded("keep@example.test")).toBe(true);
    expect(excluded("second@example.test")).toBe(true);
    expect(excluded("keeper@example.test")).toBe(false);
  });
});
