/**
 * `bun run doctor` — checks the local setup and the deploy config without changing
 * anything. Exits non-zero when local dev cannot work.
 */
import { existsSync } from "node:fs";

import { billingSettingsSchema } from "../packages/features/src/billing/domain/settings";
import { workspaceSettingsSchema } from "../packages/features/src/workspaces/domain/config";

import {
  DEV_VARS,
  ENVIRONMENTS,
  envBlock,
  PLACEHOLDER_ID,
  readDevVars,
  readWranglerConfig,
  wrangler,
} from "./lib";

/** Required platform settings (apps/web/src/lib/config.ts parsePlatformConfig), no defaults. */
const PLATFORM_SETTINGS = {
  LOG_SINK: ["workers-logs", "none"],
  ERROR_REPORTER: ["workers-logs", "none"],
  FEATURE_FLAGS: ["d1", "none"],
  METRICS: ["analytics-engine", "none"],
  TRACING: ["workers", "none"],
} as const;

/** Analytics settings (apps/web/src/lib/config.ts parseAnalyticsConfig), no defaults. */
const ANALYTICS_SETTINGS = {
  ANALYTICS: ["analytics-engine", "none"],
  WEB_ANALYTICS: ["cloudflare", "none"],
} as const;

let errors = 0;
const ok = (message: string) => console.log(`✓ ${message}`);
const warn = (message: string) => console.log(`! ${message}`);
const error = (message: string) => {
  errors += 1;
  console.log(`✗ ${message}`);
};

/**
 * The analytics vars of one environment, checked like parseAnalyticsConfig does at
 * startup. `secret` is the ANALYTICS_ID_SECRET when it can be read (locally), undefined
 * for deployed environments (Worker secrets cannot be read back).
 */
function checkAnalyticsVars(
  label: string,
  vars: Readonly<Record<string, string | undefined>>,
  secret?: string
) {
  for (const [name, allowed] of Object.entries(ANALYTICS_SETTINGS)) {
    const value = vars[name];
    if (!(allowed as readonly string[]).includes(value ?? "")) {
      error(
        `${label}: ${name} is ${value ? `"${value}"` : "not set"} (${allowed.join(" | ")}): bun run setup:analytics${label === "local" ? " (or .dev.vars.example)" : ` --env ${label}`}`
      );
      return;
    }
  }
  ok(
    `${label}: ANALYTICS=${vars.ANALYTICS}, WEB_ANALYTICS=${vars.WEB_ANALYTICS}`
  );
  if (vars.ANALYTICS === "analytics-engine") {
    if (secret === undefined)
      warn(
        `${label}: ANALYTICS=analytics-engine needs the ANALYTICS_ID_SECRET Worker secret (bun run setup:secrets --env ${label})`
      );
    else if (secret.length < 32)
      error(
        `${label}: ANALYTICS=analytics-engine needs ANALYTICS_ID_SECRET (32+ characters) in .dev.vars`
      );
  }
  if (vars.WEB_ANALYTICS === "cloudflare" && !vars.WEB_ANALYTICS_TOKEN)
    error(`${label}: WEB_ANALYTICS=cloudflare needs WEB_ANALYTICS_TOKEN`);
}

/**
 * The workspace and sign-up vars of one environment, checked like the app does at
 * startup (workspaceSettingsSchema and the auth checks in apps/web/src/server/auth.ts).
 */
function checkWorkspaceVars(
  label: string,
  vars: Readonly<Record<string, string | undefined>>
) {
  const workspaces = workspaceSettingsSchema.safeParse(
    Object.fromEntries(
      Object.entries(vars).map(([key, value]) => [key, value || undefined])
    )
  );
  if (!workspaces.success) {
    error(
      `${label}: ${workspaces.error.issues.map((issue) => issue.message).join("; ")} (bun run setup:auth)`
    );
    return;
  }
  ok(
    `${label}: WORKSPACE_MODE=${workspaces.data.mode}, SIGN_UP=${workspaces.data.signUp}`
  );
  const unverified =
    vars.AUTH_EMAIL_PASSWORD !== "false" &&
    vars.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true";
  if (unverified && workspaces.data.bootstrapAdminEmail) {
    error(
      `${label}: BOOTSTRAP_ADMIN_EMAIL needs AUTH_REQUIRE_EMAIL_VERIFICATION=true (the app refuses to start)`
    );
  }
  if (
    unverified &&
    workspaces.data.mode === "single" &&
    workspaces.data.signUpDomains.length > 0
  ) {
    error(
      `${label}: SIGN_UP_DOMAINS in single mode needs AUTH_REQUIRE_EMAIL_VERIFICATION=true (the app refuses to start)`
    );
  }
  if (workspaces.data.signUp === "invite" && !vars.EMAIL_FROM) {
    warn(
      `${label}: SIGN_UP=invite without EMAIL_FROM: invitation links do not reach anyone`
    );
  }
}

/** BILLING of one environment: required, off | manual | provider (setup:auth writes it). */
function checkBillingVar(label: string, value: string | undefined) {
  const billing = billingSettingsSchema.safeParse({
    BILLING: value || undefined,
  });
  if (!billing.success) {
    error(
      `${label}: ${billing.error.issues.map((issue) => issue.message).join("; ")} (bun run setup:auth; the Worker refuses to start)`
    );
    return;
  }
  ok(`${label}: BILLING=${billing.data.mode}`);
  if (billing.data.mode === "provider")
    warn(
      `${label}: BILLING=provider needs a provider adapter registered in apps/web/src/server/billing-provider.ts (the starter ships none)`
    );
}

console.log("Local dev");
if (!existsSync(DEV_VARS)) {
  error(
    "apps/web/.dev.vars is missing: bun run setup:secrets (or copy .dev.vars.example)"
  );
} else {
  const vars = readDevVars();
  const value = (key: string) => vars.get(key) || undefined;

  // Vars come from .dev.vars, else from the top level of wrangler.jsonc.
  const topVars =
    (readWranglerConfig().vars as Record<string, string> | undefined) ?? {};
  const setting = (key: string) => value(key) ?? (topVars[key] || undefined);

  const rateLimiting = setting("RATE_LIMITING");
  if (rateLimiting === "cloudflare" || rateLimiting === "none")
    ok(`RATE_LIMITING=${rateLimiting}`);
  else error("RATE_LIMITING must be cloudflare or none");
  const turnstile = setting("TURNSTILE");
  if (turnstile === "off") warn("TURNSTILE=off: no human check on sign-up");
  else if (turnstile !== "on") error("TURNSTILE must be on or off");
  else if (!setting("TURNSTILE_SITE_KEY") || !value("TURNSTILE_SECRET_KEY"))
    error(
      "TURNSTILE=on needs TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY (copy them from .dev.vars.example)"
    );
  else ok("Turnstile on");

  if (value("APP_URL")) ok(`APP_URL ${value("APP_URL")}`);
  else error("APP_URL is not set");

  const secret = value("BETTER_AUTH_SECRET") ?? "";
  if (secret.length >= 32) ok("BETTER_AUTH_SECRET set");
  else error("BETTER_AUTH_SECRET is missing or shorter than 32 characters");

  const emailPassword = value("AUTH_EMAIL_PASSWORD") !== "false";
  const google = Boolean(
    value("GOOGLE_CLIENT_ID") && value("GOOGLE_CLIENT_SECRET")
  );
  if (emailPassword || google) {
    ok(
      `sign-in: ${[emailPassword && "email + password", google && "Google"].filter(Boolean).join(", ")}`
    );
  } else {
    error("no sign-in method: AUTH_EMAIL_PASSWORD=false and no Google keys");
  }

  if (value("APP_ENV") === "local") ok("APP_ENV=local (local development)");
  else
    warn(
      "APP_ENV is not local in .dev.vars: add APP_ENV=local (auth links are logged only there when email is off)"
    );

  if (value("EMAIL_FROM"))
    ok(`email from ${value("EMAIL_FROM")} (simulated locally)`);
  else if (value("APP_ENV") === "local")
    warn("EMAIL_FROM empty: email off, auth links go to the dev log");
  else
    warn(
      "EMAIL_FROM empty and APP_ENV not local: password reset and verification requests will fail"
    );
  if (
    value("AUTH_REQUIRE_EMAIL_VERIFICATION") === "true" &&
    !value("EMAIL_FROM")
  ) {
    error("AUTH_REQUIRE_EMAIL_VERIFICATION=true needs EMAIL_FROM");
  }

  const r2 = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_FILES_BUCKET_NAME",
  ];
  const r2Set = r2.filter((key) => value(key)).length;
  if (r2Set === r2.length) ok("R2 presigned URLs configured");
  else if (r2Set === 0)
    warn("R2 presigned URLs off (the FILES binding works without them)");
  else error(`R2 presigned URLs half configured: set all of ${r2.join(", ")}`);

  // .dev.vars overrides the wrangler.jsonc vars locally; a blank line there unsets them.
  for (const [name, allowed] of Object.entries(PLATFORM_SETTINGS)) {
    if (!vars.has(name)) continue;
    const local = vars.get(name) ?? "";
    if ((allowed as readonly string[]).includes(local))
      ok(`${name}=${local} (.dev.vars override)`);
    else
      error(
        `${name} in .dev.vars is "${local}": use one of ${allowed.join(", ")} or delete the line`
      );
  }

  // Local dev reads them from .dev.vars (wrangler.jsonc ships none).
  checkWorkspaceVars("local", Object.fromEntries(vars));
  checkAnalyticsVars(
    "local",
    Object.fromEntries(vars),
    value("ANALYTICS_ID_SECRET") ?? ""
  );
  checkBillingVar("local", vars.get("BILLING"));
}

const migrations = wrangler(["d1", "migrations", "list", "DB", "--local"]);
if (!migrations.ok)
  error(`local D1 check failed: ${migrations.stderr.trim().split("\n")[0]}`);
else if (/No migrations to apply/i.test(migrations.stdout))
  ok("local D1 migrations applied");
else error("local D1 has pending migrations: bun run db:migrate:local");

console.log("\nDeploy config (apps/web/wrangler.jsonc)");
const config = readWranglerConfig();
/** Cloudflare's dummy site keys (always pass, always fail, forced challenge). */
const TURNSTILE_TEST_SITE_KEYS = /^[123]x0{20}(AA|AB|BB|FF)$/;
const namespaceIds: string[] = [];
for (const env of ENVIRONMENTS) {
  const block = envBlock(config, env);
  const d1 = (block.d1_databases as { database_id: string }[] | undefined)?.[0];
  const vars = (block.vars as Record<string, string> | undefined) ?? {};
  for (const [name, allowed] of Object.entries(PLATFORM_SETTINGS)) {
    const value = vars[name];
    if (!value)
      error(`${env}: ${name} missing from vars (${allowed.join(" | ")})`);
    else if (!(allowed as readonly string[]).includes(value))
      error(`${env}: ${name} is "${value}" (${allowed.join(" | ")})`);
    else ok(`${env}: ${name}=${value}`);
  }
  // METRICS=analytics-engine writes to the METRICS_DATASET binding of this environment.
  const datasets =
    (block.analytics_engine_datasets as
      | { binding: string; dataset?: string }[]
      | undefined) ?? [];
  const metricsDataset = datasets.find(
    (entry) => entry.binding === "METRICS_DATASET"
  );
  if (vars.METRICS === "analytics-engine") {
    if (metricsDataset?.dataset)
      ok(`${env}: METRICS_DATASET → ${metricsDataset.dataset}`);
    else
      error(
        `${env}: METRICS=analytics-engine needs the METRICS_DATASET binding in analytics_engine_datasets`
      );
  }
  // APP_ENV is required too (no default) and names the environment it is set in.
  if (vars.APP_ENV === env) ok(`${env}: APP_ENV=${env}`);
  else
    error(
      `${env}: APP_ENV must be "${env}" in vars (it is ${vars.APP_ENV ? `"${vars.APP_ENV}"` : "missing"})`
    );
  const notes = [
    d1?.database_id === PLACEHOLDER_ID
      ? "placeholder D1 id (bun run setup:cloudflare)"
      : null,
    vars.EMAIL_FROM
      ? null
      : "no EMAIL_FROM: password reset and verification requests fail (bun run setup:email)",
  ].filter(Boolean);
  if (notes.length) warn(`${env}: ${notes.join("; ")}`);
  else ok(`${env}: D1 id and email sender set`);

  // Workspace and sign-up vars: no defaults are shipped, setup:auth writes them.
  if (!vars.WORKSPACE_MODE && !vars.SIGN_UP) {
    warn(
      `${env}: no WORKSPACE_MODE/SIGN_UP yet: bun run setup:auth --env ${env} before deploying (the Worker refuses to start)`
    );
  } else {
    checkWorkspaceVars(env, vars);
  }
  // Analytics vars: no defaults are shipped, setup:analytics writes them.
  if (!vars.ANALYTICS && !vars.WEB_ANALYTICS) {
    warn(
      `${env}: no ANALYTICS/WEB_ANALYTICS yet: bun run setup:analytics --env ${env} before deploying (the Worker refuses to start)`
    );
  } else {
    checkAnalyticsVars(env, vars);
  }
  if (!datasets.some((entry) => entry.binding === "ANALYTICS_EVENTS"))
    error(
      `${env}: the ANALYTICS_EVENTS analytics_engine_datasets binding is missing`
    );
  // Abuse protection (docs/guides/how-to-configure-abuse-protection.md).
  if (!["cloudflare", "none"].includes(vars.RATE_LIMITING ?? ""))
    error(`${env}: RATE_LIMITING must be cloudflare or none`);
  if (vars.TURNSTILE === "on") {
    if (!vars.TURNSTILE_SITE_KEY)
      error(`${env}: TURNSTILE=on needs TURNSTILE_SITE_KEY`);
    else if (TURNSTILE_TEST_SITE_KEYS.test(vars.TURNSTILE_SITE_KEY)) {
      const message = `${env}: TURNSTILE_SITE_KEY is a Cloudflare test key: put the widget's own site key in wrangler.jsonc`;
      if (env === "staging" || env === "production") warn(message);
    }
    warn(
      `${env}: TURNSTILE=on needs the TURNSTILE_SECRET_KEY Worker secret (bun run setup:secrets --env ${env})`
    );
  } else if (vars.TURNSTILE !== "off") {
    error(`${env}: TURNSTILE must be on or off`);
  }
  const ids = (
    (block.ratelimits as { namespace_id: string }[] | undefined) ?? []
  ).map((binding) => binding.namespace_id);
  namespaceIds.push(...ids);
  if (!vars.BILLING) {
    warn(
      `${env}: no BILLING yet: bun run setup:auth --env ${env} before deploying (the Worker refuses to start)`
    );
  } else {
    checkBillingVar(env, vars.BILLING);
  }
}
const duplicates = namespaceIds.filter(
  (id, index) => namespaceIds.indexOf(id) !== index
);
if (duplicates.length)
  error(
    `ratelimits namespace_id used twice: ${[...new Set(duplicates)].join(", ")} (each binding in each environment needs its own)`
  );
else ok(`ratelimits: ${namespaceIds.length} bindings, unique namespace_ids`);

const who = wrangler(["whoami"]);
if (who.ok && !/not authenticated/i.test(who.stdout))
  ok("Wrangler is logged in");
else
  warn(
    "Wrangler is not logged in (bunx wrangler login) — needed only for remote commands"
  );

console.log(errors ? `\n${errors} problem(s) to fix.` : "\nAll good.");
process.exit(errors ? 1 : 0);
