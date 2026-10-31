/**
 * Used only by the Better Auth CLI to regenerate the auth tables after adding or
 * upgrading Better Auth plugins (see docs/guides/how-to-setup-auth.md):
 *   bunx auth@<better-auth version> generate --config scripts/auth-schema.config.ts \
 *     --output ../../packages/features/src/accounts/accounts.schema.generated.ts
 * then replace packages/features/src/accounts/accounts.schema.ts with the result.
 */
import { betterAuth } from "better-auth";

import { createAuthOptions } from "../src/server/auth";
import type { AppEnv } from "../src/server/env";

const env = {
  APP_URL: "http://localhost:4321",
  BETTER_AUTH_SECRET: "schema-generation-only-secret-000000",
  APP_ENV: "local",
  WORKSPACE_MODE: "multi",
  SIGN_UP: "open",
  ADMIN_PORTAL: "on",
  BILLING: "manual",
  TWO_FACTOR: "optional",
  TWO_FACTOR_EMAIL_OTP: "off",
  TWO_FACTOR_TRUSTED_DEVICE_DAYS: "0",
  PASSKEYS: "on",
} as unknown as AppEnv;

export const auth = betterAuth(createAuthOptions(env));
