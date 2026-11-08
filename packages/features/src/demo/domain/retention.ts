import type { DemoRetentionPolicy } from "./settings";

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An account is erased only when its warning went out at least this long before the
 * run: the daily runs are ~24 h apart, so the warning one run sends is old enough for
 * the next. An account that was never warned (demo mode just turned on, a missed run)
 * is warned first and erased by a later run, never straight away.
 */
export const DEMO_WARNING_LEAD_MS = 12 * 60 * 60 * 1000;

/** Accounts erased per job delivery. */
export const DEMO_ERASE_BATCH = 20;
/** Deliveries per cron run: at most DEMO_ERASE_BATCH × this many erasures a day. */
export const DEMO_MAX_BATCHES_PER_RUN = 5;
/** Warnings enqueued per cron run. */
export const DEMO_WARN_CAP = 200;
/** Accounts one delivery looks at, at most (exempt ones included). */
export const DEMO_SCAN_MAX = 2000;

/** Days the admin overview's "erased" counter covers. */
export const DEMO_STATS_ERASED_DAYS = 7;

/** What the retention needs to know about an account. */
export interface DemoAccount {
  readonly email: string;
  readonly createdAt: Date;
  /** Better Auth admin plugin role: comma-separated, e.g. "user" or "user,admin". */
  readonly role: string | null;
}

export type DemoExemption =
  | "platform_admin"
  | "bootstrap_admin"
  | "protected_email"
  | "qa_account";

export type DemoRetentionDecision =
  | { readonly action: "exempt"; readonly reason: DemoExemption }
  | { readonly action: "keep" }
  /** In its last day: warn it (unless already warned). */
  | { readonly action: "warn"; readonly deletesAt: Date }
  /** Past the retention: erase it once warned at least DEMO_WARNING_LEAD_MS ago, else warn. */
  | { readonly action: "erase"; readonly deletesAt: Date };

/** Whether a Better Auth role list includes `admin`. */
export function isPlatformAdminRole(role: string | null): boolean {
  return (role ?? "")
    .split(",")
    .map((part) => part.trim())
    .includes("admin");
}

/** The domain of an address, lowercased ("" when it has none). */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1
    ? ""
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

/** Why an account is never erased by the retention, or null. */
export function demoExemption(
  account: Pick<DemoAccount, "email" | "role">,
  policy: Omit<DemoRetentionPolicy, "retentionDays">
): DemoExemption | null {
  const email = account.email.trim().toLowerCase();
  if (isPlatformAdminRole(account.role)) return "platform_admin";
  if (policy.bootstrapAdminEmail && email === policy.bootstrapAdminEmail)
    return "bootstrap_admin";
  if (policy.protectedEmails.includes(email)) return "protected_email";
  if (policy.qaEmailDomain && emailDomain(email) === policy.qaEmailDomain)
    return "qa_account";
  return null;
}

/** When an account created at `createdAt` is due for erasure. */
export function demoDeletionTime(createdAt: Date, retentionDays: number): Date {
  return new Date(createdAt.getTime() + retentionDays * DAY_MS);
}

/** Accounts created at or before this are in their warning window, or past it. */
export function demoWarnCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - (retentionDays - 1) * DAY_MS);
}

/**
 * The retention's rule for one account at `now`:
 * - platform admins, BOOTSTRAP_ADMIN_EMAIL, DEMO_PROTECTED_EMAILS and QA_EMAIL_DOMAIN
 *   addresses (case-insensitive) are exempt, whatever their age;
 * - an account at least DEMO_RETENTION_DAYS old is due for erasure;
 * - one at least DEMO_RETENTION_DAYS − 1 days old is in its warning window;
 * - younger ones are kept.
 */
export function demoRetentionDecision(
  account: DemoAccount,
  policy: DemoRetentionPolicy,
  now: Date
): DemoRetentionDecision {
  const reason = demoExemption(account, policy);
  if (reason) return { action: "exempt", reason };
  const deletesAt = demoDeletionTime(account.createdAt, policy.retentionDays);
  if (deletesAt.getTime() <= now.getTime())
    return { action: "erase", deletesAt };
  if (
    account.createdAt.getTime() <=
    demoWarnCutoff(now, policy.retentionDays).getTime()
  )
    return { action: "warn", deletesAt };
  return { action: "keep" };
}

/**
 * How long a warning stays current. An older one (the account was protected or an admin
 * meanwhile, and is not any more) no longer counts: the account is warned again first.
 * Long enough for a backlog or a blocked account to be erased on a later day without a
 * new warning every day.
 */
export const DEMO_WARNING_VALID_MS = 7 * DAY_MS;

/** Whether a warning sent at `warnedAt` is still current at `now`. */
export function isCurrentWarning(warnedAt: Date | null, now: Date): boolean {
  return (
    warnedAt !== null &&
    warnedAt.getTime() > now.getTime() - DEMO_WARNING_VALID_MS
  );
}

/**
 * Whether a warning sent at `warnedAt` lets the run at `now` erase the account: current,
 * and at least DEMO_WARNING_LEAD_MS old.
 */
export function warnedLongEnoughAgo(warnedAt: Date | null, now: Date): boolean {
  return (
    warnedAt !== null &&
    isCurrentWarning(warnedAt, now) &&
    warnedAt.getTime() <= now.getTime() - DEMO_WARNING_LEAD_MS
  );
}
