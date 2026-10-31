import {
  type BillingSettings,
  billingSettingsSchema,
  type SecuritySettings,
  STORAGE_RECONCILE_MODES,
  type StorageReconcileMode,
  securitySettingsSchema,
  type WorkspaceSettings,
  workspaceSettingsSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

/** A boolean var: "true"/"false" in wrangler.jsonc or .dev.vars, unset means `fallback`. */
const flag = (fallback: boolean) =>
  z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) =>
      value === undefined ? fallback : value === true || value === "true"
    );

const envSchema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_FILES_BUCKET_NAME: z.string().min(1).optional(),
  AUTH_EMAIL_PASSWORD: flag(true),
  AUTH_REQUIRE_EMAIL_VERIFICATION: flag(false),
  EMAIL_FROM: z.email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
  // Required, no default (validated with a named error by parsePlatformConfig).
  APP_ENV: z.enum(["local", "develop", "staging", "production"]),
});

/** Whether the admin portal (`/admin`, the `admin.*` procedures and tools) is served. */
export const ADMIN_PORTAL_VALUES = ["on", "off"] as const;
export type AdminPortalSetting = (typeof ADMIN_PORTAL_VALUES)[number];

/**
 * The environment's config. `workspaces` holds WORKSPACE_MODE, SIGN_UP, SIGN_UP_DOMAINS and
 * BOOTSTRAP_ADMIN_EMAIL, required and without defaults (docs/guides/how-to-configure-workspaces.md).
 * `billing` holds BILLING (off | manual | provider), required and without a default
 * (docs/guides/how-to-configure-plans-and-billing.md). `ADMIN_PORTAL` (on | off) is
 * required too (docs/guides/how-to-use-admin-portal.md).
 */
export type AppConfig = z.infer<typeof envSchema> & {
  readonly workspaces: WorkspaceSettings;
  readonly billing: BillingSettings;
  readonly security: SecuritySettings;
  readonly ADMIN_PORTAL: AdminPortalSetting;
  readonly STORAGE_RECONCILE: StorageReconcileMode;
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

export interface AbuseConfig {
  readonly RATE_LIMITING: (typeof RATE_LIMITERS)[number];
  readonly TURNSTILE: (typeof TURNSTILE_SETTINGS)[number];
  readonly TURNSTILE_SITE_KEY: string | null;
  readonly TURNSTILE_SECRET_KEY: string | null;
}

/**
 * Abuse protection settings (docs/guides/how-to-configure-abuse-protection.md). Required,
 * no defaults; with TURNSTILE=on the site key (var) and secret key (secret) are required too.
 */
export function parseAbuseConfig(env: PartialEnv): AbuseConfig {
  const config: AbuseConfig = {
    RATE_LIMITING: requiredChoice(env, "RATE_LIMITING", RATE_LIMITERS),
    TURNSTILE: requiredChoice(env, "TURNSTILE", TURNSTILE_SETTINGS),
    TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY || null,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY || null,
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
