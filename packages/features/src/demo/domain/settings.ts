/**
 * Demo mode: a public instance anyone may sign up to, whose accounts are erased after
 * DEMO_RETENTION_DAYS (docs/guides/how-to-run-a-public-demo.md). Starter-only: apps built
 * from the starter keep DEMO_MODE=off. The app parses the settings
 * (apps/web/src/lib/config.ts); these are their shapes and limits.
 */

/** DEMO_MODE: required, no default. */
export const DEMO_MODES = ["off", "on"] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

/** DEMO_SAMPLE_DATA: required with DEMO_MODE=on. */
export const DEMO_SAMPLE_DATA_VALUES = ["on", "off"] as const;

/**
 * DEMO_RETENTION_DAYS bounds. At least 2: the warning goes out a day before deletion, so
 * an account must live at least one day before it is warned.
 */
export const DEMO_RETENTION_MIN_DAYS = 2;
export const DEMO_RETENTION_MAX_DAYS = 365;

/** DEMO_PROTECTED_EMAILS holds at most this many addresses (each is a query parameter). */
export const DEMO_PROTECTED_EMAILS_MAX = 50;

/** The parsed DEMO_* settings. */
export type DemoSettings =
  | { readonly mode: "off" }
  | {
      readonly mode: "on";
      readonly retentionDays: number;
      readonly sampleData: boolean;
      /** Lowercased addresses the retention never erases. */
      readonly protectedEmails: readonly string[];
    };

/** Who the retention erases and when, and who it never erases besides platform admins. */
export interface DemoRetentionPolicy {
  readonly retentionDays: number;
  /** Lowercased. */
  readonly protectedEmails: readonly string[];
  /** BOOTSTRAP_ADMIN_EMAIL, lowercased, or null. */
  readonly bootstrapAdminEmail: string | null;
  /** QA_EMAIL_DOMAIN, lowercased, or null: its accounts are erased by the QA suite. */
  readonly qaEmailDomain: string | null;
}

/** What the demo feature's jobs and cron entry get: the settings and the policy. */
export type DemoRuntime =
  | { readonly mode: "off" }
  | {
      readonly mode: "on";
      readonly sampleData: boolean;
      readonly workspaceMode: "personal" | "single" | "multi";
      readonly policy: DemoRetentionPolicy;
    };

/** The public repository the demo links to. */
export const STARTER_REPOSITORY_URL =
  "https://github.com/flooper68/cloudflare-starter";

/** The demo notice of the banner and the sign-up page. */
export function demoNoticeText(retentionDays: number): string {
  return `Demo instance: your account and data are deleted after ${retentionDays} days.`;
}
