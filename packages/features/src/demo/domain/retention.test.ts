import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  DEMO_WARNING_LEAD_MS,
  demoDeletionTime,
  demoExemption,
  demoRetentionDecision,
  emailDomain,
  isPlatformAdminRole,
  warnedLongEnoughAgo,
} from "./retention";
import type { DemoRetentionPolicy } from "./settings";

const NOW = new Date("2026-11-08T03:17:00.000Z");
const policy: DemoRetentionPolicy = {
  retentionDays: 7,
  protectedEmails: ["owner@flooper.me", "second@flooper.me"],
  bootstrapAdminEmail: "founder@flooper.me",
  qaEmailDomain: "qa.flooper.me",
};
const daysAgo = (days: number, extraMs = 0) =>
  new Date(NOW.getTime() - days * DAY_MS - extraMs);
const account = (
  overrides: Partial<{ email: string; createdAt: Date; role: string | null }>
) => ({
  email: "visitor@example.test",
  createdAt: daysAgo(10),
  role: "user",
  ...overrides,
});

describe("demo retention: age", () => {
  it("keeps an account younger than DEMO_RETENTION_DAYS − 1 days", () => {
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(5) }), policy, NOW)
    ).toEqual({ action: "keep" });
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(6, -1) }), policy, NOW)
    ).toEqual({ action: "keep" });
  });

  it("warns in the last day: from DEMO_RETENTION_DAYS − 1 days old", () => {
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(6) }), policy, NOW)
    ).toEqual({ action: "warn", deletesAt: new Date(NOW.getTime() + DAY_MS) });
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(7, -1) }), policy, NOW)
        .action
    ).toBe("warn");
  });

  it("erases at DEMO_RETENTION_DAYS old and after", () => {
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(7) }), policy, NOW)
    ).toEqual({ action: "erase", deletesAt: NOW });
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(400) }), policy, NOW)
        .action
    ).toBe("erase");
  });

  it("follows the configured retention", () => {
    const short = { ...policy, retentionDays: 2 };
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(1) }), short, NOW)
        .action
    ).toBe("warn");
    expect(
      demoRetentionDecision(account({ createdAt: daysAgo(2) }), short, NOW)
        .action
    ).toBe("erase");
    expect(demoDeletionTime(daysAgo(2), 2)).toEqual(NOW);
  });
});

describe("demo retention: exemptions, whatever the age", () => {
  it("never erases platform admins", () => {
    for (const role of ["admin", "user,admin", "admin, user"]) {
      expect(demoRetentionDecision(account({ role }), policy, NOW)).toEqual({
        action: "exempt",
        reason: "platform_admin",
      });
    }
    expect(isPlatformAdminRole("user")).toBe(false);
    expect(isPlatformAdminRole("superadmin")).toBe(false);
    expect(isPlatformAdminRole(null)).toBe(false);
  });

  it("never erases the bootstrap admin email, case-insensitively", () => {
    expect(
      demoRetentionDecision(
        account({ email: "Founder@Flooper.me" }),
        policy,
        NOW
      )
    ).toEqual({ action: "exempt", reason: "bootstrap_admin" });
  });

  it("never erases DEMO_PROTECTED_EMAILS, case-insensitively and trimmed", () => {
    expect(
      demoRetentionDecision(
        account({ email: " SECOND@flooper.me " }),
        policy,
        NOW
      )
    ).toEqual({ action: "exempt", reason: "protected_email" });
    expect(
      demoRetentionDecision(account({ email: "third@flooper.me" }), policy, NOW)
        .action
    ).toBe("erase");
  });

  it("never warns or erases QA_EMAIL_DOMAIN accounts (their suite erases them)", () => {
    for (const email of [
      "qa+20261108abcd-owner@qa.flooper.me",
      "qa@QA.flooper.me",
    ]) {
      expect(demoRetentionDecision(account({ email }), policy, NOW)).toEqual({
        action: "exempt",
        reason: "qa_account",
      });
    }
    // Only that exact domain: not a subdomain or a look-alike.
    for (const email of [
      "qa@sub.qa.flooper.me",
      "qa@qa.flooper.me.evil.test",
      "qa.flooper.me@example.test",
    ]) {
      expect(
        demoRetentionDecision(account({ email }), policy, NOW).action
      ).toBe("erase");
    }
  });

  it("without a QA domain or bootstrap admin, only admins and the list are exempt", () => {
    const bare = {
      retentionDays: 7,
      protectedEmails: [],
      bootstrapAdminEmail: null,
      qaEmailDomain: null,
    };
    expect(
      demoExemption({ email: "qa@qa.flooper.me", role: "user" }, bare)
    ).toBeNull();
    expect(
      demoExemption({ email: "founder@flooper.me", role: null }, bare)
    ).toBeNull();
    expect(demoExemption({ email: "x@y.test", role: "admin" }, bare)).toBe(
      "platform_admin"
    );
  });

  it("reads the domain of an address", () => {
    expect(emailDomain("A@B.Example")).toBe("b.example");
    expect(emailDomain("no-at-sign")).toBe("");
  });
});

describe("demo retention: the warning comes first", () => {
  it("erases only accounts warned at least DEMO_WARNING_LEAD_MS before the run", () => {
    expect(warnedLongEnoughAgo(null, NOW)).toBe(false);
    expect(
      warnedLongEnoughAgo(new Date(NOW.getTime() - DEMO_WARNING_LEAD_MS), NOW)
    ).toBe(true);
    expect(
      warnedLongEnoughAgo(
        new Date(NOW.getTime() - DEMO_WARNING_LEAD_MS + 1),
        NOW
      )
    ).toBe(false);
    // The previous day's run, a few seconds later than today's.
    expect(
      warnedLongEnoughAgo(new Date(NOW.getTime() - DAY_MS + 5000), NOW)
    ).toBe(true);
  });
});
