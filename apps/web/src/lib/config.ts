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
