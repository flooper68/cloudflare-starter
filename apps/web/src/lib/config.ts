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
  APP_ENV: z.string().min(1).default("local"),
});

export type AppConfig = z.infer<typeof envSchema>;

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
  return envSchema.parse(env);
}

/** Where logs go: Cloudflare Workers Logs, or nowhere. */
export const LOG_SINKS = ["workers-logs", "none"] as const;
/** Where error reports go: Cloudflare Workers Logs, or nowhere (users still get a reference). */
export const ERROR_REPORTERS = ["workers-logs", "none"] as const;

export interface PlatformConfig {
  readonly LOG_SINK: (typeof LOG_SINKS)[number];
  readonly ERROR_REPORTER: (typeof ERROR_REPORTERS)[number];
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
  allowed: readonly T[]
): T {
  const value = env[name];
  const hint = `set ${name} to one of ${allowed.join(", ")} in the vars of apps/web/wrangler.jsonc for every environment`;
  if (value === undefined || value === "") {
    throw new ConfigError(name, `${name} is not set: ${hint}`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ConfigError(name, `${name} is "${value}": ${hint}`);
  }
  return value as T;
}

/**
 * The platform adapters to use. No defaults: a deployment states where its logs and error
 * reports go, and a missing setting fails every request with an error that names it.
 */
export function parsePlatformConfig(env: PartialEnv): PlatformConfig {
  return {
    LOG_SINK: requiredChoice(env, "LOG_SINK", LOG_SINKS),
    ERROR_REPORTER: requiredChoice(env, "ERROR_REPORTER", ERROR_REPORTERS),
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
