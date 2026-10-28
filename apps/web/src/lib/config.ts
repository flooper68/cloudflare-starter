import {
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

/**
 * The environment's config. `workspaces` holds WORKSPACE_MODE, SIGN_UP, SIGN_UP_DOMAINS and
 * BOOTSTRAP_ADMIN_EMAIL, required and without defaults (docs/guides/how-to-configure-workspaces.md).
 */
export type AppConfig = z.infer<typeof envSchema> & {
  readonly workspaces: WorkspaceSettings;
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
  };
}

/** Where logs go: Cloudflare Workers Logs, or nowhere. */
export const LOG_SINKS = ["workers-logs", "none"] as const;
/** Where error reports go: Cloudflare Workers Logs, or nowhere (users still get a reference). */
export const ERROR_REPORTERS = ["workers-logs", "none"] as const;

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
