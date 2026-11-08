/**
 * `bun run setup:qa-inbox [--domain qa.flooper.me] [--zone flooper.me] [--dry-run]
 *                         [--replace-catch-all] [--enable-zone-routing]`
 *
 * Sets up the automated QA suite's test inbox (apps/qa-inbox), idempotently:
 * 1. the D1 database `cloudflare-starter-qa-inbox` (created once; its id is written into
 *    apps/qa-inbox/wrangler.jsonc) and its migrations;
 * 2. deploys the `cloudflare-starter-qa-inbox` Worker;
 * 3. the QA_INBOX_TOKEN secret, when it is not set yet (asked for, sent on stdin);
 * 4. Email Routing on the subdomain (`--domain`, default QA_EMAIL_DOMAIN of production):
 *    its MX and SPF records. Wrangler has no command for a subdomain, so this one step
 *    calls the Email Routing API with Wrangler's own login (`wrangler auth token`) or
 *    CLOUDFLARE_API_TOKEN;
 * 5. the zone's catch-all rule → the Worker (`wrangler email routing rules update`), only
 *    when the catch-all is off or drops mail, or with `--replace-catch-all`.
 *
 * It never enables Email Routing for the whole zone (that takes over the apex's MX
 * records) unless `--enable-zone-routing` says so. `--dry-run` calls nothing and changes
 * no file: it prints every command and API call. Guide: docs/guides/how-to-qa-a-deployment.md#the-qa-inbox
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { applyEdits, modify, parse } from "jsonc-parser";

import {
  ask,
  envBlock,
  fail,
  PLACEHOLDER_ID,
  ROOT,
  readWranglerConfig,
} from "./lib";
import {
  type CatchAllRule,
  catchAllPlan,
  databaseIdFrom,
  databaseIdFromCreate,
  expectedRecords,
  isSubdomainOf,
  QA_INBOX_DATABASE,
  QA_INBOX_WORKER,
  subdomainRoutingReady,
  zoneOf,
} from "./qa-inbox-plan";

const INBOX = join(ROOT, "apps/qa-inbox");
const INBOX_CONFIG = join(INBOX, "wrangler.jsonc");
const API = "https://api.cloudflare.com/client/v4";

const { values } = parseArgs({
  options: {
    domain: { type: "string" },
    zone: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "replace-catch-all": { type: "boolean", default: false },
    "enable-zone-routing": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const productionVars = (envBlock(readWranglerConfig(), "production").vars ??
  {}) as Record<string, string>;
const domain = (values.domain ?? productionVars.QA_EMAIL_DOMAIN ?? "")
  .trim()
  .toLowerCase();
if (!domain)
  fail("--domain is required (or QA_EMAIL_DOMAIN in production vars)");
const zone = (values.zone ?? zoneOf(domain)).toLowerCase();
if (!isSubdomainOf(domain, zone)) {
  fail(
    `${domain} is not a subdomain of ${zone}: the inbox gets a subdomain of its own (pass --zone if the zone is not the last two labels)`
  );
}
const inboxVars = (parse(readFileSync(INBOX_CONFIG, "utf8")).vars ??
  {}) as Record<string, string>;
if (inboxVars.QA_EMAIL_DOMAIN !== domain) {
  fail(
    `apps/qa-inbox/wrangler.jsonc vars.QA_EMAIL_DOMAIN is "${inboxVars.QA_EMAIL_DOMAIN}", not ${domain}: set it first`
  );
}

interface Run {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** The repository's Wrangler in apps/qa-inbox; with --dry-run it only prints the command. */
function inboxWrangler(args: readonly string[], input?: string): Run {
  console.log(
    `  ${dryRun ? "(dry run) " : "$ "}cd apps/qa-inbox && wrangler ${args.join(" ")}`
  );
  if (dryRun) return { ok: true, stdout: "", stderr: "" };
  const result = spawnSync("bunx", ["wrangler", ...args], {
    cwd: INBOX,
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

let cachedToken: string | undefined;

/** An API token: CLOUDFLARE_API_TOKEN, else Wrangler's OAuth login. Never printed. */
function apiToken(): string {
  cachedToken ??= readApiToken();
  return cachedToken;
}

function readApiToken(): string {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const result = spawnSync("bunx", ["wrangler", "auth", "token"], {
    cwd: INBOX,
    encoding: "utf8",
  });
  const token = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^[\w.-]{30,}$/.test(line));
  if (result.status !== 0 || !token) {
    fail(
      "No Cloudflare credentials for the Email Routing API: bunx wrangler login, or set CLOUDFLARE_API_TOKEN (Zone Read, Email Routing Rules Edit, Zone Settings Edit)"
    );
  }
  return token;
}

/** One Email Routing API call; with --dry-run it only prints it. */
async function api(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  console.log(
    `  ${dryRun ? "(dry run) " : "$ "}${method} ${API}${path}${body ? ` ${JSON.stringify(body)}` : ""}`
  );
  if (dryRun) return { ok: true, json: {} };
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiToken()}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { ok: response.ok && json.success !== false, json };
}

function apiErrors(json: Record<string, unknown>): string {
  return JSON.stringify(json.errors ?? json);
}

console.log(
  `QA inbox: ${QA_INBOX_WORKER}, mail to *@${domain} (zone ${zone})${dryRun ? " — dry run, nothing is called or changed" : ""}\n`
);

// 1. D1 database and migrations.
console.log("1. D1 database");
const configText = readFileSync(INBOX_CONFIG, "utf8");
const configured = (
  parse(configText).d1_databases as { database_id: string }[]
)[0]?.database_id;
let databaseId =
  configured && configured !== PLACEHOLDER_ID ? configured : null;
if (databaseId) {
  console.log(
    `  ✓ wrangler.jsonc already names ${QA_INBOX_DATABASE} (${databaseId})`
  );
} else {
  const list = inboxWrangler(["d1", "list", "--json"]);
  databaseId = dryRun ? null : databaseIdFrom(list.stdout, QA_INBOX_DATABASE);
  if (!databaseId) {
    const created = inboxWrangler(["d1", "create", QA_INBOX_DATABASE]);
    if (!created.ok) fail(created.stderr.trim() || "wrangler d1 create failed");
    databaseId = dryRun
      ? "<new id>"
      : (databaseIdFromCreate(created.stdout) ??
        fail(`could not read the new database id from:\n${created.stdout}`));
  }
  console.log(
    `  ${dryRun ? "(dry run) " : "✓ "}apps/qa-inbox/wrangler.jsonc d1_databases.0.database_id = "${databaseId}"`
  );
  if (!dryRun) {
    const edits = modify(
      configText,
      ["d1_databases", 0, "database_id"],
      databaseId,
      {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }
    );
    writeFileSync(INBOX_CONFIG, applyEdits(configText, edits));
  }
}
const migrated = inboxWrangler([
  "d1",
  "migrations",
  "apply",
  "INBOX",
  "--remote",
]);
if (!migrated.ok) fail(migrated.stderr.trim() || "migrations failed");

// 2. Deploy.
console.log("\n2. Worker");
const deployed = inboxWrangler(["deploy"]);
if (!deployed.ok) fail(deployed.stderr.trim() || "wrangler deploy failed");
const url = /https:\/\/[\w.-]+\.workers\.dev/.exec(deployed.stdout)?.[0];
if (url) console.log(`  ✓ deployed: ${url} (the QA_INBOX_URL GitHub secret)`);

// 3. The API's bearer token.
console.log("\n3. QA_INBOX_TOKEN secret");
const secrets = inboxWrangler(["secret", "list", "--format", "json"]);
if (!dryRun && secrets.stdout.includes('"QA_INBOX_TOKEN"')) {
  console.log("  ✓ QA_INBOX_TOKEN is set (it cannot be read back)");
} else if (dryRun) {
  inboxWrangler(["secret", "put", "QA_INBOX_TOKEN"]);
  console.log(
    "  (dry run) the value is asked for and sent on stdin, never as an argument"
  );
} else {
  const token = await ask(
    "QA_INBOX_TOKEN: the inbox API's bearer token, 32+ chars (openssl rand -hex 32; store the same value as the QA_INBOX_TOKEN GitHub secret). Enter skips.\n> ",
    true
  );
  if (token && token.length < 32)
    fail("QA_INBOX_TOKEN must be at least 32 characters");
  if (token) {
    const put = inboxWrangler(["secret", "put", "QA_INBOX_TOKEN"], token);
    if (!put.ok) fail(put.stderr.trim() || "wrangler secret put failed");
    console.log("  ✓ QA_INBOX_TOKEN set");
  } else {
    console.log("  ! skipped: the API refuses every request until it is set");
  }
}

// 4. Email Routing on the subdomain.
console.log(`\n4. Email Routing for ${domain}`);
const zones = await api("GET", `/zones?name=${encodeURIComponent(zone)}`);
const zoneId = dryRun
  ? "<zone id>"
  : ((zones.json.result as { id: string }[] | undefined)?.[0]?.id ??
    fail(`zone ${zone} not found in this account: ${apiErrors(zones.json)}`));
const settings = await api("GET", `/zones/${zoneId}/email/routing`);
const zoneEnabled = Boolean(
  (settings.json.result as { enabled?: boolean } | undefined)?.enabled
);
if (!dryRun && !zoneEnabled) {
  if (!values["enable-zone-routing"]) {
    fail(
      `Email Routing is off for the zone ${zone}. Turning it on adds Cloudflare's MX records to ${zone} itself, which takes over any mail the apex receives elsewhere. If that is fine, re-run with --enable-zone-routing; otherwise enable only the subdomain in the dashboard (Email > Email Routing > Settings > Subdomains) and re-run.`
    );
  }
  const enabled = inboxWrangler(["email", "routing", "enable", zone]);
  if (!enabled.ok)
    fail(enabled.stderr.trim() || "enabling Email Routing failed");
} else if (dryRun) {
  console.log(
    `  (dry run) if Email Routing is off for ${zone}: stop, unless --enable-zone-routing (then: wrangler email routing enable ${zone})`
  );
}
const dns = await api(
  "GET",
  `/zones/${zoneId}/email/routing/dns?subdomain=${encodeURIComponent(domain)}`
);
if (!dryRun && subdomainRoutingReady(dns.json)) {
  console.log(`  ✓ MX and SPF records for ${domain} are in place`);
} else {
  const added = await api("POST", `/zones/${zoneId}/email/routing/dns`, {
    name: domain,
  });
  if (!added.ok) fail(`could not enable ${domain}: ${apiErrors(added.json)}`);
  console.log(`  ${dryRun ? "(dry run) creates" : "✓ created"}:`);
  for (const record of expectedRecords(domain)) console.log(`    ${record}`);
}

// 5. The catch-all rule.
console.log("\n5. Catch-all rule");
const current = await api(
  "GET",
  `/zones/${zoneId}/email/routing/rules/catch_all`
);
const plan = dryRun
  ? {
      action: "set" as const,
      reason:
        "if it is off or drops mail (else it stops, unless --replace-catch-all)",
    }
  : catchAllPlan(
      (current.json.result as CatchAllRule | undefined) ?? null,
      QA_INBOX_WORKER,
      values["replace-catch-all"] ?? false
    );
if (plan.action === "conflict") fail(plan.reason);
if (plan.action === "keep") {
  console.log(`  ✓ ${plan.reason}`);
} else {
  console.log(`  ${plan.reason}`);
  const rule = inboxWrangler([
    "email",
    "routing",
    "rules",
    "update",
    zone,
    "catch-all",
    "--action-type",
    "worker",
    "--action-value",
    QA_INBOX_WORKER,
    "--enabled",
    "true",
  ]);
  if (!rule.ok) fail(rule.stderr.trim() || "updating the catch-all failed");
}

console.log(
  dryRun
    ? "\nDry run: nothing was called or changed."
    : `\nDone. Send a test mail to qa-20260101test-check@${domain} and read it with:\n  curl -H "Authorization: Bearer $QA_INBOX_TOKEN" "${url ?? "<QA_INBOX_URL>"}/messages?to=qa-20260101test-check@${domain}"`
);
