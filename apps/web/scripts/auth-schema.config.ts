/**
 * Used only by the Better Auth CLI to regenerate the auth tables after adding or
 * upgrading Better Auth plugins (see docs/how-to-setup-auth.md):
 *   bunx auth@<better-auth version> generate --config scripts/auth-schema.config.ts \
 *     --output ../../packages/features/src/db/schema/auth.generated.ts
 * then merge the result into packages/features/src/db/schema/auth.ts.
 */
import { betterAuth } from "better-auth";

import { createAuthOptions } from "../src/server/auth";
import type { AppEnv } from "../src/server/env";

const env = {
  APP_URL: "http://localhost:4321",
  BETTER_AUTH_SECRET: "schema-generation-only-secret-000000",
} as unknown as AppEnv;

export const auth = betterAuth(createAuthOptions(env));
