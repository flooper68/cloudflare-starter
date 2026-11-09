/**
 * Every setting of the web app, in one list: the source of docs/reference/settings.md
 * (generated, `bun run docs:reference`). The allowed values come from the constants the
 * app validates with (config.ts and the features package), and a test fails when a var in
 * apps/web/.dev.vars.example or apps/web/wrangler.jsonc is missing here or one here is in
 * neither, so the page cannot drift from the code.
 */
import {
  BILLING_MODES,
  SIGN_UP_POLICIES,
  STORAGE_RECONCILE_MODES,
  TWO_FACTOR_MODES,
  WORKSPACE_MODES,
} from "@cloudflare-starter/features";

import {
  ADMIN_PORTAL_VALUES,
  ANALYTICS_PROVIDERS,
  APP_ENVS,
  BOOLEAN_SETTING_VALUES,
  CSP_MODES,
  ERROR_REPORTERS,
  FEATURE_FLAG_PROVIDERS,
  LOG_SINKS,
  METRICS_BACKENDS,
  RATE_LIMITERS,
  TRACING_BACKENDS,
  TURNSTILE_SETTINGS,
  WEB_ANALYTICS_SETTINGS,
} from "@/lib/config";

export type SettingGroup =
  | "Core"
  | "Sign-in and security"
  | "Workspaces and billing"
  | "Email"
  | "Files and privacy"
  | "Observability"
  | "Abuse protection and headers"
  | "Demo and QA";

export interface Setting {
  readonly name: string;
  readonly group: SettingGroup;
  /** `var`: in wrangler.jsonc or .dev.vars; `secret`: `bun run setup:secrets`, never committed. */
  readonly kind: "var" | "secret";
  /** The allowed values, when the setting is a choice. */
  readonly values?: readonly string[];
  readonly description: string;
  /** The doc that explains it, from the repository root. */
  readonly doc: string;
  /** Removed by `starter:strip` from a project's config (starter-only.json). */
  readonly starterOnly?: boolean;
}

// Starter-only settings spell their values out: `starter:strip` deletes their constants.
const ON_OFF = ["on", "off"] as const;

export const SETTINGS: readonly Setting[] = [
  // Core
  {
    name: "APP_ENV",
    group: "Core",
    kind: "var",
    values: APP_ENVS,
    description:
      "Which environment this is; `local` is the only one where auth links may be logged.",
    doc: "docs/start/deploy.md",
  },
  {
    name: "APP_URL",
    group: "Core",
    kind: "var",
    description:
      "The app's public origin. Sign-in trusts only this origin; passkeys belong to its hostname.",
    doc: "docs/start/deploy.md",
  },
  {
    name: "BETTER_AUTH_SECRET",
    group: "Core",
    kind: "secret",
    description: "Signs sessions and tokens; at least 32 characters.",
    doc: "docs/guides/how-to-setup-auth.md",
  },
  // Sign-in and security
  {
    name: "AUTH_EMAIL_PASSWORD",
    group: "Sign-in and security",
    kind: "var",
    values: BOOLEAN_SETTING_VALUES,
    description:
      "Email and password sign-in. At least one sign-in method must be on.",
    doc: "docs/guides/how-to-setup-auth.md",
  },
  {
    name: "AUTH_REQUIRE_EMAIL_VERIFICATION",
    group: "Sign-in and security",
    kind: "var",
    values: BOOLEAN_SETTING_VALUES,
    description: "New accounts confirm their address before they can sign in.",
    doc: "docs/guides/how-to-setup-email.md",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    group: "Sign-in and security",
    kind: "secret",
    description:
      "Google sign-in, with GOOGLE_CLIENT_SECRET; both set turns it on.",
    doc: "docs/guides/how-to-setup-auth.md",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    group: "Sign-in and security",
    kind: "secret",
    description: "Google sign-in's client secret.",
    doc: "docs/guides/how-to-setup-auth.md",
  },
  {
    name: "TWO_FACTOR",
    group: "Sign-in and security",
    kind: "var",
    values: TWO_FACTOR_MODES,
    description: "Who must set up an authenticator app.",
    doc: "docs/guides/how-to-configure-account-security.md",
  },
  {
    name: "TWO_FACTOR_EMAIL_OTP",
    group: "Sign-in and security",
    kind: "var",
    values: ON_OFF,
    description:
      "Emailed codes as a recovery option after an authenticator is set up.",
    doc: "docs/guides/how-to-configure-account-security.md",
  },
  {
    name: "TWO_FACTOR_TRUSTED_DEVICE_DAYS",
    group: "Sign-in and security",
    kind: "var",
    description:
      "Days a browser may skip the code, 0 to 30; 0 turns remembered devices off.",
    doc: "docs/guides/how-to-configure-account-security.md",
  },
  {
    name: "PASSKEYS",
    group: "Sign-in and security",
    kind: "var",
    values: ON_OFF,
    description: "Passkey sign-in.",
    doc: "docs/guides/how-to-configure-account-security.md",
  },
  {
    name: "ADMIN_PORTAL",
    group: "Sign-in and security",
    kind: "var",
    values: ADMIN_PORTAL_VALUES,
    description: "The admin portal at /admin and the admin tools for agents.",
    doc: "docs/guides/how-to-use-admin-portal.md",
  },
  // Workspaces and billing
  {
    name: "WORKSPACE_MODE",
    group: "Workspaces and billing",
    kind: "var",
    values: WORKSPACE_MODES,
    description:
      "Everyone alone, one shared workspace, or many. No default when deployed.",
    doc: "docs/guides/how-to-configure-workspaces.md",
  },
  {
    name: "SIGN_UP",
    group: "Workspaces and billing",
    kind: "var",
    values: SIGN_UP_POLICIES,
    description:
      "Anyone may sign up, or only people let in. No default when deployed.",
    doc: "docs/guides/how-to-configure-workspaces.md",
  },
  {
    name: "SIGN_UP_DOMAINS",
    group: "Workspaces and billing",
    kind: "var",
    description:
      "With invite-only sign-up: email domains that may sign up without an invitation.",
    doc: "docs/guides/how-to-configure-workspaces.md",
  },
  {
    name: "BOOTSTRAP_ADMIN_EMAIL",
    group: "Workspaces and billing",
    kind: "var",
    description:
      "May always sign up; becomes a platform admin once verified and owns the workspace in single mode.",
    doc: "docs/guides/how-to-configure-workspaces.md",
  },
  {
    name: "BILLING",
    group: "Workspaces and billing",
    kind: "var",
    values: BILLING_MODES,
    description:
      "Everything unlimited, plans an admin assigns, or a payment provider.",
    doc: "docs/guides/how-to-configure-plans-and-billing.md",
  },
  // Email
  {
    name: "EMAIL_FROM",
    group: "Email",
    kind: "var",
    description: "The sender address; blank turns email off.",
    doc: "docs/guides/how-to-setup-email.md",
  },
  {
    name: "EMAIL_FROM_NAME",
    group: "Email",
    kind: "var",
    description: "The sender's display name.",
    doc: "docs/guides/how-to-setup-email.md",
  },
  // Files and privacy
  {
    name: "STORAGE_RECONCILE",
    group: "Files and privacy",
    kind: "var",
    values: STORAGE_RECONCILE_MODES,
    description:
      "The daily check for orphaned files: off, report them, or delete them.",
    doc: "docs/guides/how-to-use-trash.md",
  },
  {
    name: "R2_ACCOUNT_ID",
    group: "Files and privacy",
    kind: "secret",
    description:
      "Signed upload and download links: your Cloudflare account id.",
    doc: "docs/guides/how-to-setup-r2.md",
  },
  {
    name: "R2_ACCESS_KEY_ID",
    group: "Files and privacy",
    kind: "secret",
    description: "Signed links: an access key limited to the files bucket.",
    doc: "docs/guides/how-to-setup-r2.md",
  },
  {
    name: "R2_SECRET_ACCESS_KEY",
    group: "Files and privacy",
    kind: "secret",
    description: "Signed links: the access key's secret.",
    doc: "docs/guides/how-to-setup-r2.md",
  },
  {
    name: "R2_FILES_BUCKET_NAME",
    group: "Files and privacy",
    kind: "secret",
    description: "Signed links: the files bucket's name.",
    doc: "docs/guides/how-to-setup-r2.md",
  },
  // Observability
  {
    name: "LOG_SINK",
    group: "Observability",
    kind: "var",
    values: LOG_SINKS,
    description: "Where logs go.",
    doc: "docs/guides/how-to-setup-logging.md",
  },
  {
    name: "ERROR_REPORTER",
    group: "Observability",
    kind: "var",
    values: ERROR_REPORTERS,
    description: "Where error reports go.",
    doc: "docs/guides/how-to-setup-error-reporting.md",
  },
  {
    name: "METRICS",
    group: "Observability",
    kind: "var",
    values: METRICS_BACKENDS,
    description:
      "Latency and counts of requests, procedures, jobs and schedules.",
    doc: "docs/guides/how-to-setup-metrics-and-tracing.md",
  },
  {
    name: "TRACING",
    group: "Observability",
    kind: "var",
    values: TRACING_BACKENDS,
    description: "Traces across requests and jobs.",
    doc: "docs/guides/how-to-setup-metrics-and-tracing.md",
  },
  {
    name: "ANALYTICS",
    group: "Observability",
    kind: "var",
    values: ANALYTICS_PROVIDERS,
    description: "Product events under pseudonymous ids.",
    doc: "docs/guides/how-to-setup-product-analytics.md",
  },
  {
    name: "ANALYTICS_ID_SECRET",
    group: "Observability",
    kind: "secret",
    description:
      "Key of the pseudonymous user and workspace ids; 32+ characters.",
    doc: "docs/guides/how-to-setup-product-analytics.md",
  },
  {
    name: "WEB_ANALYTICS",
    group: "Observability",
    kind: "var",
    values: WEB_ANALYTICS_SETTINGS,
    description: "Cookieless page views.",
    doc: "docs/guides/how-to-setup-product-analytics.md",
  },
  {
    name: "WEB_ANALYTICS_TOKEN",
    group: "Observability",
    kind: "var",
    description: "The web analytics site token, with WEB_ANALYTICS=cloudflare.",
    doc: "docs/guides/how-to-setup-product-analytics.md",
  },
  {
    name: "FEATURE_FLAGS",
    group: "Observability",
    kind: "var",
    values: FEATURE_FLAG_PROVIDERS,
    description:
      "Flags stored in the database, or every flag at its catalog default.",
    doc: "docs/guides/how-to-use-feature-flags.md",
  },
  // Abuse protection and headers
  {
    name: "RATE_LIMITING",
    group: "Abuse protection and headers",
    kind: "var",
    values: RATE_LIMITERS,
    description: "Rate limits on every action and sign-in.",
    doc: "docs/guides/how-to-configure-abuse-protection.md",
  },
  {
    name: "TURNSTILE",
    group: "Abuse protection and headers",
    kind: "var",
    values: TURNSTILE_SETTINGS,
    description: "The bot check on sign-up, sign-in and password reset.",
    doc: "docs/guides/how-to-configure-abuse-protection.md",
  },
  {
    name: "TURNSTILE_SITE_KEY",
    group: "Abuse protection and headers",
    kind: "var",
    description: "The bot check's public site key.",
    doc: "docs/guides/how-to-configure-abuse-protection.md",
  },
  {
    name: "TURNSTILE_SECRET_KEY",
    group: "Abuse protection and headers",
    kind: "secret",
    description: "The bot check's secret key.",
    doc: "docs/guides/how-to-configure-abuse-protection.md",
  },
  {
    name: "CSP_MODE",
    group: "Abuse protection and headers",
    kind: "var",
    values: CSP_MODES,
    description: "Enforce the content policy, or only report violations.",
    doc: "docs/guides/how-to-configure-security-headers.md",
  },
  // Demo and QA
  {
    name: "DEMO_MODE",
    group: "Demo and QA",
    kind: "var",
    values: ["off", "on"],
    description: "The starter's public demo; apps built from it keep off.",
    doc: "docs/guides/how-to-run-a-public-demo.md",
    starterOnly: true,
  },
  {
    name: "DEMO_RETENTION_DAYS",
    group: "Demo and QA",
    kind: "var",
    description:
      "With the demo on: days before a demo account is erased, 2 to 365.",
    doc: "docs/guides/how-to-run-a-public-demo.md",
    starterOnly: true,
  },
  {
    name: "DEMO_SAMPLE_DATA",
    group: "Demo and QA",
    kind: "var",
    values: ON_OFF,
    description:
      "With the demo on: new demo workspaces start with sample data.",
    doc: "docs/guides/how-to-run-a-public-demo.md",
    starterOnly: true,
  },
  {
    name: "DEMO_PROTECTED_EMAILS",
    group: "Demo and QA",
    kind: "var",
    description:
      "With the demo on: addresses the demo never erases, comma separated.",
    doc: "docs/guides/how-to-run-a-public-demo.md",
    starterOnly: true,
  },
  {
    name: "QA_BYPASS",
    group: "Demo and QA",
    kind: "var",
    values: ON_OFF,
    description:
      "Lets the automated QA suite skip the bot check, with QA_TOKEN.",
    doc: "docs/guides/how-to-qa-a-deployment.md",
    starterOnly: true,
  },
  {
    name: "QA_TOKEN",
    group: "Demo and QA",
    kind: "secret",
    description: "The QA suite's token; 32+ characters.",
    doc: "docs/guides/how-to-qa-a-deployment.md",
    starterOnly: true,
  },
  {
    name: "QA_EMAIL_DOMAIN",
    group: "Demo and QA",
    kind: "var",
    description: "The email domain of QA accounts.",
    doc: "docs/guides/how-to-qa-a-deployment.md",
    starterOnly: true,
  },
];
