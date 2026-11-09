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
  METRICS: "analytics-engine",
  TRACING: "workers",
  STORAGE_RECONCILE: "off",
  // Demo mode off, as in the develop vars; test/api/demo-mode.test.ts turns it on.
  DEMO_MODE: "off",
  DEMO_RETENTION_DAYS: "7",
  DEMO_SAMPLE_DATA: "on",
  DEMO_PROTECTED_EMAILS: "",
  CSP_MODE: "enforce",
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
  // Abuse protection: the wrangler.jsonc values, and Cloudflare's always-pass test secret
  // (Siteverify is answered by test/outbound.ts).
  RATE_LIMITING: "cloudflare",
  TURNSTILE: "on",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  // The QA suite's human-check bypass, on as in the develop vars, with a test token
  // (test/api/qa-bypass.test.ts; tests of QA_BYPASS=off override it).
  QA_BYPASS: "on",
  QA_EMAIL_DOMAIN: "qa.flooper.me",
  QA_TOKEN: "api-test-qa-token-0123456789abcdefghij",
  // Not in wrangler.jsonc (setup:auth writes them per environment); tests of other modes
  // or with the admin portal off override them (test/api/helpers.ts envWith).
  WORKSPACE_MODE: "multi",
  SIGN_UP: "open",
  SIGN_UP_DOMAINS: "",
  BOOTSTRAP_ADMIN_EMAIL: "",
  // Not in wrangler.jsonc either (setup:analytics writes them per environment). Product
  // events go to the simulated ANALYTICS_EVENTS dataset under a test key; no beacon.
  ANALYTICS: "analytics-engine",
  ANALYTICS_ID_SECRET: "api-test-analytics-id-secret-0123456789",
  WEB_ANALYTICS: "none",
  WEB_ANALYTICS_TOKEN: "",
  ADMIN_PORTAL: "on",
  // Setup-written too: manual billing, so new workspaces start the catalog's trial and
  // limits apply; billing tests of other modes override it (envWith).
  BILLING: "manual",
  TWO_FACTOR: "optional",
  TWO_FACTOR_EMAIL_OTP: "off",
  TWO_FACTOR_TRUSTED_DEVICE_DAYS: "0",
  PASSKEYS: "on",
  // The container workflow demo, as in the develop vars: on, with the fake pi computer (no
  // Docker; the Workflow runs in Miniflare). Tests of off or the cap override them.
  CONTAINER_DEMO: "on",
  CONTAINER_DEMO_DAILY_CAP: "50",
  CONTAINER_DEMO_RUNNER: "fake",
} as const satisfies Readonly<Record<string, string>>;
