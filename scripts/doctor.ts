/**
 * `bun run doctor` — checks the local setup and the deploy config without changing
 * anything. Exits non-zero when local dev cannot work.
 */
import { existsSync } from "node:fs";

import { securitySettingsSchema } from "../packages/features/src/accounts/domain/security-policy";
import { billingSettingsSchema } from "../packages/features/src/billing/domain/settings";
import {
  DEMO_PROTECTED_EMAILS_MAX,
  DEMO_RETENTION_MAX_DAYS,
  DEMO_RETENTION_MIN_DAYS,
} from "../packages/features/src/demo/domain/settings";
import { workspaceSettingsSchema } from "../packages/features/src/workspaces/domain/config";

import {
  describeIds,
  STARTER_SHIPPED_NAMESPACE_IDS,
  STARTER_WORKER_NAME,
} from "./cloudflare-plan";
import {
  DEV_VARS,
  ENVIRONMENTS,
  type Environment,
  envBlock,
  PLACEHOLDER_ID,
  readDevVars,
  readWranglerConfig,
  wrangler,
} from "./lib";

function checkSecurity(
  label: string,
  vars: Record<string, string | undefined>
) {
  const security = securitySettingsSchema.safeParse(vars);
  if (!security.success)
    error(
      `${label}: security settings invalid: ${security.error.issues.map((issue) => issue.path.join(".")).join(", ")}; run setup:auth`
    );
  else
    ok(
      `${label}: TWO_FACTOR=${security.data.mode}, PASSKEYS=${security.data.passkeys ? "on" : "off"}`
    );
}

/**
 * Required settings shipped in every environment's vars, no defaults: the platform adapters
 * (apps/web/src/lib/config.ts parsePlatformConfig) and the sign-in switches (parseAppConfig).
 */
const PLATFORM_SETTINGS = {
  LOG_SINK: ["workers-logs", "none"],
  ERROR_REPORTER: ["workers-logs", "none"],
  FEATURE_FLAGS: ["d1", "none"],
  METRICS: ["analytics-engine", "none"],
  TRACING: ["workers", "none"],
  // The pages' Content-Security-Policy (docs/guides/how-to-configure-security-headers.md).
  CSP_MODE: ["enforce", "report-only"],
  AUTH_EMAIL_PASSWORD: ["true", "false"],
  AUTH_REQUIRE_EMAIL_VERIFICATION: ["true", "false"],
} as const;

/** Analytics settings (apps/web/src/lib/config.ts parseAnalyticsConfig), no defaults. */
const ANALYTICS_SETTINGS = {
  ANALYTICS: ["analytics-engine", "none"],
  WEB_ANALYTICS: ["cloudflare", "none"],
} as const;

/** A lowercase hostname with two labels or more (apps/web/src/lib/config.ts). */
const QA_EMAIL_DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

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
  // Required, no default (apps/web/src/lib/config.ts): the Worker refuses to start without it.
  if (vars.ADMIN_PORTAL === "on" || vars.ADMIN_PORTAL === "off") {
    ok(`${label}: ADMIN_PORTAL=${vars.ADMIN_PORTAL}`);
  } else {
    error(
      `${label}: ADMIN_PORTAL must be on or off (it is ${vars.ADMIN_PORTAL ? `"${vars.ADMIN_PORTAL}"` : "missing"}): bun run setup:auth`
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
  checkQaBypass("local", setting, (key) => value(key));

  if (value("APP_URL")) ok(`APP_URL ${value("APP_URL")}`);
  else error("APP_URL is not set");

  const secret = value("BETTER_AUTH_SECRET") ?? "";
  if (secret.length >= 32) ok("BETTER_AUTH_SECRET set");
  else error("BETTER_AUTH_SECRET is missing or shorter than 32 characters");

  for (const name of [
    "AUTH_EMAIL_PASSWORD",
    "AUTH_REQUIRE_EMAIL_VERIFICATION",
  ]) {
    const current = setting(name);
    if (current !== "true" && current !== "false")
      error(
        `${name} is ${current ? `"${current}"` : "not set"} (true | false, no default)`
      );
  }
  const emailPassword = setting("AUTH_EMAIL_PASSWORD") === "true";
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
    setting("AUTH_REQUIRE_EMAIL_VERIFICATION") === "true" &&
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
  checkStorageVar("local", vars.get("STORAGE_RECONCILE"));
  // .dev.vars overrides the develop var; wrangler.jsonc's applies without the line.
  checkDemoVars("local", (key) => vars.get(key) ?? topVars[key]);
  checkBillingVar("local", vars.get("BILLING"));
  checkSecurity("local", Object.fromEntries(vars));
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
const namespaceIdsByEnv = new Map<Environment, string[]>();
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
  if (env === "production" && vars.CSP_MODE === "report-only")
    warn(
      "production: CSP_MODE=report-only blocks nothing; switch back to enforce once the reports are clean"
    );
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
      // A warning, not an error: local dev still works. Deployed with the always-pass
      // test key, the human check stops nobody.
      if (env === "production")
        warn(
          `${env}: TURNSTILE_SITE_KEY is a Cloudflare TEST key: do not deploy production with it (the human check would stop nobody, or block everyone); create the widget and put its site key in wrangler.jsonc`
        );
      else if (env === "staging")
        warn(
          `${env}: TURNSTILE_SITE_KEY is a Cloudflare test key: put the widget's own site key in wrangler.jsonc`
        );
    }
    warn(
      `${env}: TURNSTILE=on needs the TURNSTILE_SECRET_KEY Worker secret (bun run setup:secrets --env ${env})`
    );
  } else if (vars.TURNSTILE !== "off") {
    error(`${env}: TURNSTILE must be on or off`);
  }
  // Deployed secrets cannot be read back: QA_TOKEN is only reminded of.
  checkQaBypass(env, (key) => vars[key] || undefined, null);
  const ids = (
    (block.ratelimits as { namespace_id: string }[] | undefined) ?? []
  ).map((binding) => binding.namespace_id);
  namespaceIds.push(...ids);
  namespaceIdsByEnv.set(env, ids);
  checkStorageVar(env, vars.STORAGE_RECONCILE);
  checkContainerDemo(env, vars, block);
  checkDemoVars(env, (key) => vars[key]);
  if (vars.TWO_FACTOR) checkSecurity(env, vars);
  else
    warn(
      `${env}: security policy not chosen yet: bun run setup:auth --env ${env}`
    );
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
else
  ok(
    `ratelimits: ${namespaceIds.length} bindings, namespace_ids unique in wrangler.jsonc`
  );
// namespace_ids are account-wide: this file cannot show what other Workers use.
warn(
  `ratelimits: namespace_ids must be unique across the whole Cloudflare account (a Worker binding the same id shares the counters); in use here: ${[
    ...namespaceIdsByEnv,
  ]
    .map(([env, ids]) => `${env} ${describeIds(ids)}`)
    .join(
      ", "
    )} (docs/guides/how-to-configure-abuse-protection.md#namespace-ids)`
);
const workerName = String(config.name ?? "");
if (
  workerName !== STARTER_WORKER_NAME &&
  namespaceIds.some((id) => STARTER_SHIPPED_NAMESPACE_IDS.has(id))
)
  error(
    "ratelimits: still the starter's namespace_ids, shared with every project that kept them: bun run setup:cloudflare --env all --dry-run, then without --dry-run"
  );

const who = wrangler(["whoami"]);
if (who.ok && !/not authenticated/i.test(who.stdout))
  ok("Wrangler is logged in");
else
  warn(
    "Wrangler is not logged in (bunx wrangler login) — needed only for remote commands"
  );

console.log(errors ? `\n${errors} problem(s) to fix.` : "\nAll good.");
process.exit(errors ? 1 : 0);

/**
 * QA_BYPASS (on | off, required) and, with on, QA_EMAIL_DOMAIN and the QA_TOKEN secret, as
 * parseAbuseConfig checks them at startup. `secret` reads QA_TOKEN where it can be read
 * (.dev.vars), null for a deployed environment.
 */
function checkQaBypass(
  label: string,
  setting: (key: string) => string | undefined,
  secret: ((key: string) => string | undefined) | null
) {
  const bypass = setting("QA_BYPASS");
  if (bypass === "off") {
    ok(`${label}: QA_BYPASS=off (Turnstile for everyone)`);
    return;
  }
  if (bypass !== "on") {
    error(
      `${label}: QA_BYPASS must be on or off (it is ${bypass ? `"${bypass}"` : "missing"}; docs/guides/how-to-configure-abuse-protection.md#qa-bypass)`
    );
    return;
  }
  const domain = setting("QA_EMAIL_DOMAIN");
  if (!domain || !QA_EMAIL_DOMAIN_PATTERN.test(domain))
    error(
      `${label}: QA_BYPASS=on needs QA_EMAIL_DOMAIN, a lowercase hostname (it is ${domain ? `"${domain}"` : "missing"})`
    );
  else
    ok(
      `${label}: QA_BYPASS=on: X-QA-Token skips Turnstile for @${domain} only`
    );
  if (secret === null)
    warn(
      `${label}: QA_BYPASS=on needs the QA_TOKEN Worker secret, the same value as the QA_TOKEN GitHub secret (bun run setup:secrets --env ${label})`
    );
  else if ((secret("QA_TOKEN") ?? "").length < 32)
    error(
      `${label}: QA_BYPASS=on needs QA_TOKEN (32+ characters) in .dev.vars, or set QA_BYPASS=off there`
    );
}

/**
 * The container workflow demo's required settings (docs/guides/how-to-run-container-workflows.md#settings)
 * and, with it on, its Workflow binding and (for the real container) the service binding.
 */
function checkContainerDemo(
  label: string,
  vars: Record<string, string | undefined>,
  block: Record<string, unknown>
) {
  const mode = vars.CONTAINER_DEMO;
  const cap = vars.CONTAINER_DEMO_DAILY_CAP ?? "";
  const runner = vars.CONTAINER_DEMO_RUNNER;
  if (mode !== "on" && mode !== "off")
    error(`${label}: CONTAINER_DEMO must be on or off (required, no default)`);
  if (!/^[1-9]\d*$/.test(cap) || Number(cap) > 10_000)
    error(
      `${label}: CONTAINER_DEMO_DAILY_CAP must be a whole number of runs per day, 1 to 10000`
    );
  if (runner !== "container" && runner !== "fake")
    error(`${label}: CONTAINER_DEMO_RUNNER must be container or fake`);
  if (mode !== "on") {
    if (mode === "off") ok(`${label}: CONTAINER_DEMO=off`);
    return;
  }
  const workflows =
    (block.workflows as { binding?: string }[] | undefined) ?? [];
  if (!workflows.some((entry) => entry.binding === "CONTAINER_RUN_WORKFLOW"))
    error(
      `${label}: CONTAINER_DEMO=on needs the CONTAINER_RUN_WORKFLOW workflows binding`
    );
  const services = (block.services as { binding?: string }[] | undefined) ?? [];
  if (
    runner === "container" &&
    !services.some((entry) => entry.binding === "PI_CONTAINER_SERVICE")
  )
    error(
      `${label}: CONTAINER_DEMO_RUNNER=container needs the PI_CONTAINER_SERVICE service binding`
    );
  else
    ok(
      `${label}: CONTAINER_DEMO=on, ${runner} runner, at most ${cap} runs a day`
    );
}

/**
 * DEMO_MODE (off | on, required; docs/guides/how-to-run-a-public-demo.md) and, with on,
 * DEMO_RETENTION_DAYS, DEMO_SAMPLE_DATA and DEMO_PROTECTED_EMAILS, as parseDemoConfig
 * checks them. Starter-only: a project keeps off.
 */
function checkDemoVars(
  label: string,
  setting: (key: string) => string | undefined
) {
  const mode = setting("DEMO_MODE");
  if (mode === "off") {
    ok(`${label}: DEMO_MODE=off`);
    return;
  }
  if (mode !== "on") {
    error(
      `${label}: DEMO_MODE must be off or on (it is ${mode ? `"${mode}"` : "missing"}; docs/guides/how-to-run-a-public-demo.md)`
    );
    return;
  }
  const days = setting("DEMO_RETENTION_DAYS") ?? "";
  const n = Number(days);
  const daysOk =
    /^\d+$/.test(days) &&
    n >= DEMO_RETENTION_MIN_DAYS &&
    n <= DEMO_RETENTION_MAX_DAYS;
  if (!daysOk)
    error(
      `${label}: DEMO_MODE=on needs DEMO_RETENTION_DAYS, a whole number from ${DEMO_RETENTION_MIN_DAYS} to ${DEMO_RETENTION_MAX_DAYS} (it is ${days ? `"${days}"` : "missing"})`
    );
  const sample = setting("DEMO_SAMPLE_DATA");
  if (sample !== "on" && sample !== "off")
    error(`${label}: DEMO_MODE=on needs DEMO_SAMPLE_DATA=on or off`);
  const emails = (setting("DEMO_PROTECTED_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const bad = emails.filter(
    (email) => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)
  );
  if (bad.length)
    error(
      `${label}: DEMO_PROTECTED_EMAILS has entries that are not addresses: ${bad.join(", ")}`
    );
  if (emails.length > DEMO_PROTECTED_EMAILS_MAX)
    error(
      `${label}: DEMO_PROTECTED_EMAILS holds at most ${DEMO_PROTECTED_EMAILS_MAX} addresses`
    );
  if (daysOk && (sample === "on" || sample === "off"))
    ok(
      `${label}: DEMO_MODE=on: accounts erased after ${n} days (warned a day before), sample data ${sample}, ${emails.length} protected address${emails.length === 1 ? "" : "es"} besides admins, BOOTSTRAP_ADMIN_EMAIL and QA_EMAIL_DOMAIN`
    );
}

/** Explicit orphan-maintenance setting, required in every runtime environment. */
function checkStorageVar(label: string, value: string | undefined) {
  if (!value || !["off", "report", "delete"].includes(value))
    error(
      `${label}: STORAGE_RECONCILE must be off, report or delete; bun run setup:storage --dry-run --env all`
    );
  else ok(`${label}: STORAGE_RECONCILE=${value}`);
}
