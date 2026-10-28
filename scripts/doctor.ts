/**
 * `bun run doctor` — checks the local setup and the deploy config without changing
 * anything. Exits non-zero when local dev cannot work.
 */
import { existsSync } from "node:fs";

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
} as const;

let errors = 0;
const ok = (message: string) => console.log(`✓ ${message}`);
const warn = (message: string) => console.log(`! ${message}`);
const error = (message: string) => {
  errors += 1;
  console.log(`✗ ${message}`);
};

console.log("Local dev");
if (!existsSync(DEV_VARS)) {
  error(
    "apps/web/.dev.vars is missing: bun run setup:secrets (or copy .dev.vars.example)"
  );
} else {
  const vars = readDevVars();
  const value = (key: string) => vars.get(key) || undefined;

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
}

const migrations = wrangler(["d1", "migrations", "list", "DB", "--local"]);
if (!migrations.ok)
  error(`local D1 check failed: ${migrations.stderr.trim().split("\n")[0]}`);
else if (/No migrations to apply/i.test(migrations.stdout))
  ok("local D1 migrations applied");
else error("local D1 has pending migrations: bun run db:migrate:local");

console.log("\nDeploy config (apps/web/wrangler.jsonc)");
const config = readWranglerConfig();
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
}

const who = wrangler(["whoami"]);
if (who.ok && !/not authenticated/i.test(who.stdout))
  ok("Wrangler is logged in");
else
  warn(
    "Wrangler is not logged in (bunx wrangler login) — needed only for remote commands"
  );

console.log(errors ? `\n${errors} problem(s) to fix.` : "\nAll good.");
process.exit(errors ? 1 : 0);
