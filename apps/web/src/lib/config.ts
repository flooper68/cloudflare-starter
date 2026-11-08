import {
  type BillingSettings,
  billingSettingsSchema,
  DEMO_MODES,
  DEMO_PROTECTED_EMAILS_MAX,
  DEMO_RETENTION_MAX_DAYS,
  DEMO_RETENTION_MIN_DAYS,
  DEMO_SAMPLE_DATA_VALUES,
  type DemoSettings,
  type SecuritySettings,
  STORAGE_RECONCILE_MODES,
  type StorageReconcileMode,
  securitySettingsSchema,
  type WorkspaceSettings,
  workspaceSettingsSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_FILES_BUCKET_NAME: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
  // Required, no default (validated with a named error by parsePlatformConfig).
  APP_ENV: z.enum(["local", "develop", "staging", "production"]),
});

/** Whether the admin portal (`/admin`, the `admin.*` procedures and tools) is served. */
export const ADMIN_PORTAL_VALUES = ["on", "off"] as const;
export type AdminPortalSetting = (typeof ADMIN_PORTAL_VALUES)[number];

/** The values of a boolean setting: written out, never implied by an unset var. */
export const BOOLEAN_SETTING_VALUES = ["true", "false"] as const;

/**
 * The environment's config. `workspaces` holds WORKSPACE_MODE, SIGN_UP, SIGN_UP_DOMAINS and
 * BOOTSTRAP_ADMIN_EMAIL, required and without defaults (docs/guides/how-to-configure-workspaces.md).
 * `billing` holds BILLING (off | manual | provider), required and without a default
 * (docs/guides/how-to-configure-plans-and-billing.md). `ADMIN_PORTAL` (on | off) is
 * required too (docs/guides/how-to-use-admin-portal.md), and so are the sign-in settings
 * AUTH_EMAIL_PASSWORD and AUTH_REQUIRE_EMAIL_VERIFICATION, "true" or "false"
 * (docs/guides/how-to-setup-auth.md).
 */
export type AppConfig = z.infer<typeof envSchema> & {
  readonly workspaces: WorkspaceSettings;
  readonly billing: BillingSettings;
  readonly security: SecuritySettings;
  readonly ADMIN_PORTAL: AdminPortalSetting;
  readonly STORAGE_RECONCILE: StorageReconcileMode;
  readonly AUTH_EMAIL_PASSWORD: boolean;
  readonly AUTH_REQUIRE_EMAIL_VERIFICATION: boolean;
  /** DEMO_MODE and, with on, DEMO_RETENTION_DAYS, DEMO_SAMPLE_DATA, DEMO_PROTECTED_EMAILS. */
  readonly demo: DemoSettings;
};

export type RequiredAppConfig = Omit<
  AppConfig,
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_FILES_BUCKET_NAME"
>;

export interface PartialEnv {
  readonly [key: string]: string | undefined;
}

export interface FeatureConfig<T> {
  readonly enabled: boolean;
  readonly value: T | null;
  readonly reason: string | null;
}

export function parseAppConfig(env: PartialEnv): AppConfig {
  return {
    ...envSchema.parse(env),
    AUTH_EMAIL_PASSWORD: requiredBoolean(env, "AUTH_EMAIL_PASSWORD"),
    AUTH_REQUIRE_EMAIL_VERIFICATION: requiredBoolean(
      env,
      "AUTH_REQUIRE_EMAIL_VERIFICATION"
    ),
    workspaces: workspaceSettingsSchema.parse(env),
    ADMIN_PORTAL: requiredChoice(
      env,
      "ADMIN_PORTAL",
      ADMIN_PORTAL_VALUES,
      "(bun run setup:auth writes it into each environment's vars; .dev.vars for local)"
    ),
    billing: billingSettingsSchema.parse(env),
    STORAGE_RECONCILE: requiredChoice(
      env,
      "STORAGE_RECONCILE",
      STORAGE_RECONCILE_MODES
    ),
    security: securitySettingsSchema.parse(env),
    demo: parseDemoConfig(env),
  };
}

const DEMO_WHERE =
  "in the vars of apps/web/wrangler.jsonc (docs/guides/how-to-run-a-public-demo.md)";

/**
 * Demo mode (docs/guides/how-to-run-a-public-demo.md), starter-only: DEMO_MODE=off|on is
 * required, no default; apps built from the starter keep off. With on, DEMO_RETENTION_DAYS
 * (an integer, 2..365) and DEMO_SAMPLE_DATA (on|off) are required too, and
 * DEMO_PROTECTED_EMAILS (optional, comma-separated addresses, at most 50) is read. With
 * off the other DEMO_* vars are ignored.
 */
export function parseDemoConfig(env: PartialEnv): DemoSettings {
  const mode = requiredChoice(env, "DEMO_MODE", DEMO_MODES, DEMO_WHERE);
  if (mode === "off") return { mode };
  const rawDays = env.DEMO_RETENTION_DAYS;
  const days = Number(rawDays);
  if (
    rawDays === undefined ||
    !/^\d+$/.test(rawDays) ||
    days < DEMO_RETENTION_MIN_DAYS ||
    days > DEMO_RETENTION_MAX_DAYS
  ) {
    throw new ConfigError(
      "DEMO_RETENTION_DAYS",
      `DEMO_MODE=on needs DEMO_RETENTION_DAYS, a whole number of days from ${DEMO_RETENTION_MIN_DAYS} to ${DEMO_RETENTION_MAX_DAYS}, ${DEMO_WHERE}${rawDays === undefined ? "" : `; "${rawDays}" is not one`}`
    );
  }
  const sampleData = requiredChoice(
    env,
    "DEMO_SAMPLE_DATA",
    DEMO_SAMPLE_DATA_VALUES,
    DEMO_WHERE
  );
  const protectedEmails = (env.DEMO_PROTECTED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email !== "");
  for (const email of protectedEmails) {
    if (!z.email().safeParse(email).success) {
      throw new ConfigError(
        "DEMO_PROTECTED_EMAILS",
        `DEMO_PROTECTED_EMAILS must be comma-separated email addresses; "${email}" is not one`
      );
    }
  }
  if (protectedEmails.length > DEMO_PROTECTED_EMAILS_MAX) {
    throw new ConfigError(
      "DEMO_PROTECTED_EMAILS",
      `DEMO_PROTECTED_EMAILS holds at most ${DEMO_PROTECTED_EMAILS_MAX} addresses`
    );
  }
  return {
    mode,
    retentionDays: days,
    sampleData: sampleData === "on",
    protectedEmails: [...new Set(protectedEmails)],
  };
}

/** Where logs go: Cloudflare Workers Logs, or nowhere. */
export const LOG_SINKS = ["workers-logs", "none"] as const;
/** Where error reports go: Cloudflare Workers Logs, or nowhere (users still get a reference). */
export const ERROR_REPORTERS = ["workers-logs", "none"] as const;
/** Where metrics go: the Workers Analytics Engine dataset (METRICS_DATASET binding), or nowhere. */
export const METRICS_BACKENDS = ["analytics-engine", "none"] as const;
/** Where spans go: span records in Workers Logs next to the request's logs, or nowhere. */
export const TRACING_BACKENDS = ["workers", "none"] as const;

/**
 * Where feature flags come from: the D1 provider (flags stored in the app's database, managed
 * with the admin.flags procedures), or none (every flag is its catalog default).
 */
export const FEATURE_FLAG_PROVIDERS = ["d1", "none"] as const;

/**
 * How the HTML pages' Content-Security-Policy is delivered: `enforce` (blocks and reports
 * violations) or `report-only` (reports them, blocks nothing; for rolling out a policy
 * change). Non-HTML responses always get an enforced policy. Required, no default
 * (docs/guides/how-to-configure-security-headers.md).
 */
export const CSP_MODES = ["enforce", "report-only"] as const;
export type CspMode = (typeof CSP_MODES)[number];

/** Which deployment this is: `local` only in .dev.vars, the others in wrangler.jsonc. */
export const APP_ENVS = ["local", "develop", "staging", "production"] as const;

export interface PlatformConfig {
  readonly APP_ENV: (typeof APP_ENVS)[number];
  readonly LOG_SINK: (typeof LOG_SINKS)[number];
  readonly ERROR_REPORTER: (typeof ERROR_REPORTERS)[number];
  readonly FEATURE_FLAGS: (typeof FEATURE_FLAG_PROVIDERS)[number];
  readonly METRICS: (typeof METRICS_BACKENDS)[number];
  readonly TRACING: (typeof TRACING_BACKENDS)[number];
  readonly STORAGE_RECONCILE: StorageReconcileMode;
  readonly CSP_MODE: CspMode;
}

/** A required setting is missing or invalid; the message names it and the allowed values. */
export class ConfigError extends Error {
  readonly setting: string;

  constructor(setting: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.setting = setting;
  }
}

function requiredChoice<T extends string>(
  env: PartialEnv,
  name: string,
  allowed: readonly T[],
  where = "in the vars of apps/web/wrangler.jsonc for every environment"
): T {
  const value = env[name];
  const hint = `set ${name} to one of ${allowed.join(", ")} ${where}`;
  if (value === undefined || value === "") {
    throw new ConfigError(name, `${name} is not set: ${hint}`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ConfigError(name, `${name} is "${value}": ${hint}`);
  }
  return value as T;
}

/** A required "true" | "false" setting, without a default (same named error as a choice). */
function requiredBoolean(env: PartialEnv, name: string): boolean {
  return requiredChoice(env, name, BOOLEAN_SETTING_VALUES) === "true";
}

/**
 * The deployment and platform adapters to use. No defaults: a deployment states which
 * environment it is, where its logs and error reports go and where its feature flags come
 * from, and a missing setting fails every request with an error that names it.
 */
export function parsePlatformConfig(env: PartialEnv): PlatformConfig {
  return {
    APP_ENV: requiredChoice(
      env,
      "APP_ENV",
      APP_ENVS,
      "(develop, staging, production in the vars of apps/web/wrangler.jsonc; local in apps/web/.dev.vars)"
    ),
    LOG_SINK: requiredChoice(env, "LOG_SINK", LOG_SINKS),
    ERROR_REPORTER: requiredChoice(env, "ERROR_REPORTER", ERROR_REPORTERS),
    FEATURE_FLAGS: requiredChoice(env, "FEATURE_FLAGS", FEATURE_FLAG_PROVIDERS),
    METRICS: requiredChoice(env, "METRICS", METRICS_BACKENDS),
    TRACING: requiredChoice(env, "TRACING", TRACING_BACKENDS),
    STORAGE_RECONCILE: requiredChoice(
      env,
      "STORAGE_RECONCILE",
      STORAGE_RECONCILE_MODES
    ),
    CSP_MODE: requiredChoice(env, "CSP_MODE", CSP_MODES),
  };
}

export function parseOptionalFeature<T>(
  label: string,
  parse: () => T
): FeatureConfig<T> {
  try {
    return { enabled: true, value: parse(), reason: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Failed to parse ${label}`;
    return {
      enabled: false,
      value: null,
      reason: `${label} is not configured: ${message}`,
    };
  }
}

export function getFeatureError(reason: string | null): string {
  return reason ?? "Feature is not configured";
}

/** Which rate limiter enforces the edge policies: Workers Rate Limiting, or nothing. */
export const RATE_LIMITERS = ["cloudflare", "none"] as const;
/** Whether sign-up, sign-in and password reset need a Cloudflare Turnstile check. */
export const TURNSTILE_SETTINGS = ["on", "off"] as const;

/** Whether the automated QA suite may skip the human check (QA_BYPASS). */
export const QA_BYPASS_SETTINGS = ["on", "off"] as const;

/** QA_TOKEN is a shared secret: at least this many characters (`openssl rand -hex 32`). */
export const QA_TOKEN_MIN_LENGTH = 32;

/** A lowercase hostname with at least two labels, e.g. `qa.flooper.me`. */
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface AbuseConfig {
  readonly RATE_LIMITING: (typeof RATE_LIMITERS)[number];
  readonly TURNSTILE: (typeof TURNSTILE_SETTINGS)[number];
  readonly TURNSTILE_SITE_KEY: string | null;
  readonly TURNSTILE_SECRET_KEY: string | null;
  readonly QA_BYPASS: (typeof QA_BYPASS_SETTINGS)[number];
  /** With QA_BYPASS=on: the shared secret and the mail domain it covers; else null. */
  readonly qaBypass: {
    readonly token: string;
    readonly emailDomain: string;
  } | null;
}

/**
 * Abuse protection settings (docs/guides/how-to-configure-abuse-protection.md). Required,
 * no defaults; with TURNSTILE=on the site key (var) and secret key (secret) are required too.
 * QA_BYPASS (on | off) is required as well; with on, the QA_TOKEN secret (32+ characters)
 * and QA_EMAIL_DOMAIN (a hostname) are required, and both are ignored with off.
 */
export function parseAbuseConfig(env: PartialEnv): AbuseConfig {
  const qaBypass = requiredChoice(env, "QA_BYPASS", QA_BYPASS_SETTINGS);
  const config: AbuseConfig = {
    RATE_LIMITING: requiredChoice(env, "RATE_LIMITING", RATE_LIMITERS),
    TURNSTILE: requiredChoice(env, "TURNSTILE", TURNSTILE_SETTINGS),
    TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY || null,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY || null,
    QA_BYPASS: qaBypass,
    qaBypass: qaBypass === "on" ? parseQaBypass(env) : null,
  };
  if (config.TURNSTILE === "on" && !config.TURNSTILE_SITE_KEY) {
    throw new ConfigError(
      "TURNSTILE_SITE_KEY",
      "TURNSTILE=on needs TURNSTILE_SITE_KEY: the widget's site key in the vars of apps/web/wrangler.jsonc"
    );
  }
  if (config.TURNSTILE === "on" && !config.TURNSTILE_SECRET_KEY) {
    throw new ConfigError(
      "TURNSTILE_SECRET_KEY",
      "TURNSTILE=on needs the TURNSTILE_SECRET_KEY secret: bun run setup:secrets --env <env>"
    );
  }
  return config;
}

/** QA_BYPASS=on: the QA_TOKEN secret and QA_EMAIL_DOMAIN, both required and checked. */
function parseQaBypass(env: PartialEnv): {
  readonly token: string;
  readonly emailDomain: string;
} {
  const token = env.QA_TOKEN ?? "";
  if (token.length < QA_TOKEN_MIN_LENGTH) {
    throw new ConfigError(
      "QA_TOKEN",
      `QA_BYPASS=on needs the QA_TOKEN secret (${QA_TOKEN_MIN_LENGTH}+ characters, e.g. openssl rand -hex 32): bun run setup:secrets --env <env>, or set QA_BYPASS to off`
    );
  }
  const emailDomain = env.QA_EMAIL_DOMAIN ?? "";
  if (!HOSTNAME.test(emailDomain)) {
    throw new ConfigError(
      "QA_EMAIL_DOMAIN",
      `QA_BYPASS=on needs QA_EMAIL_DOMAIN, the lowercase mail domain of the QA inbox (e.g. qa.example.com), in the vars of apps/web/wrangler.jsonc${emailDomain ? `; "${emailDomain}" is not a hostname` : ""}`
    );
  }
  return { token, emailDomain };
}

/** Where product events go: Workers Analytics Engine (ANALYTICS_EVENTS), or nowhere. */
export const ANALYTICS_PROVIDERS = ["analytics-engine", "none"] as const;
/** Whether pages load Cloudflare Web Analytics' cookieless beacon. */
export const WEB_ANALYTICS_SETTINGS = ["cloudflare", "none"] as const;

export interface AnalyticsConfig {
  readonly ANALYTICS: (typeof ANALYTICS_PROVIDERS)[number];
  readonly ANALYTICS_ID_SECRET: string | null;
  readonly WEB_ANALYTICS: (typeof WEB_ANALYTICS_SETTINGS)[number];
  readonly WEB_ANALYTICS_TOKEN: string | null;
}

const SETUP_ANALYTICS =
  "(bun run setup:analytics --env <env> writes it into apps/web/wrangler.jsonc; locally apps/web/.dev.vars)";

/**
 * Product and web analytics settings (docs/guides/how-to-setup-product-analytics.md).
 * Required, no defaults: each environment states whether it collects anything.
 * ANALYTICS=analytics-engine needs the ANALYTICS_ID_SECRET secret (32+ characters, the key
 * of the pseudonymous ids); WEB_ANALYTICS=cloudflare needs WEB_ANALYTICS_TOKEN.
 */
export function parseAnalyticsConfig(env: PartialEnv): AnalyticsConfig {
  const config: AnalyticsConfig = {
    ANALYTICS: requiredChoice(
      env,
      "ANALYTICS",
      ANALYTICS_PROVIDERS,
      SETUP_ANALYTICS
    ),
    ANALYTICS_ID_SECRET: env.ANALYTICS_ID_SECRET || null,
    WEB_ANALYTICS: requiredChoice(
      env,
      "WEB_ANALYTICS",
      WEB_ANALYTICS_SETTINGS,
      SETUP_ANALYTICS
    ),
    WEB_ANALYTICS_TOKEN: env.WEB_ANALYTICS_TOKEN || null,
  };
  if (
    config.ANALYTICS === "analytics-engine" &&
    (config.ANALYTICS_ID_SECRET?.length ?? 0) < 32
  ) {
    throw new ConfigError(
      "ANALYTICS_ID_SECRET",
      "ANALYTICS=analytics-engine needs the ANALYTICS_ID_SECRET secret (32+ characters): bun run setup:secrets --env <env>"
    );
  }
  if (config.WEB_ANALYTICS === "cloudflare" && !config.WEB_ANALYTICS_TOKEN) {
    throw new ConfigError(
      "WEB_ANALYTICS_TOKEN",
      "WEB_ANALYTICS=cloudflare needs WEB_ANALYTICS_TOKEN, the site token from the Cloudflare dashboard (bun run setup:analytics --env <env>)"
    );
  }
  return config;
}
