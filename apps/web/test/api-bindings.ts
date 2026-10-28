/**
 * Every var and secret the API tests run with, pinned. Wrangler also loads a developer's
 * `apps/web/.dev.vars` into the test Worker; these values override it, so a local
 * APP_ENV=local, LOG_SINK=none or Google keys cannot change what the tests see. Values
 * match the top-level (develop) `vars` of wrangler.jsonc. test/architecture/api-test-bindings.test.ts
 * checks that every key of `.dev.vars.example` and of those vars is listed here.
 */
export const API_TEST_BINDINGS = {
  APP_ENV: "develop",
  LOG_SINK: "workers-logs",
  ERROR_REPORTER: "workers-logs",
  FEATURE_FLAGS: "d1",
  APP_URL: "http://localhost:4321",
  BETTER_AUTH_SECRET: "api-test-secret-0123456789abcdefghij",
  AUTH_EMAIL_PASSWORD: "true",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  EMAIL_FROM: "noreply@example.test",
  EMAIL_FROM_NAME: "Cloudflare Starter",
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_FILES_BUCKET_NAME: "",
  // Not in wrangler.jsonc (setup:auth writes them per environment); tests of other modes
  // override them (test/api/helpers.ts envWith).
  WORKSPACE_MODE: "multi",
  SIGN_UP: "open",
  SIGN_UP_DOMAINS: "",
  BOOTSTRAP_ADMIN_EMAIL: "",
} as const satisfies Readonly<Record<string, string>>;
