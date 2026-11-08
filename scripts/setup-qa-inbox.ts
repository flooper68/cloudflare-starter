/**
 * `bun run setup:qa-inbox [--domain qa.flooper.me] [--zone flooper.me]
 *                         [--preflight | --dry-run] [--enable-zone-routing]`
 *
 * Sets up the automated QA suite's test inbox (apps/qa-inbox), idempotently, without
 * touching how the zone handles any other address:
 * 0. a read-only preflight of the zone's Email Routing: on or off, subaddressing, the
 *    catch-all and every rule. `--preflight` prints it and stops (GET requests only);
 *    otherwise it runs first and stops before changing anything if the zone's routing is
 *    off (unless `--enable-zone-routing`) or `qa@<domain>` is already routed elsewhere;
 * 1. the D1 database `cloudflare-starter-qa-inbox` (created once; its id is written into
 *    apps/qa-inbox/wrangler.jsonc) and its migrations;
 * 2. deploys the `cloudflare-starter-qa-inbox` Worker;
 * 3. the QA_INBOX_TOKEN secret, when it is not set yet (asked for, sent on stdin);
 * 4. Email Routing on the subdomain (`--domain`, default QA_EMAIL_DOMAIN of production):
 *    its MX and SPF records;
 * 5. subaddressing on for the zone (`support_subaddress`), so `qa+<tag>@<domain>` reaches
 *    the `qa@` rule; the preflight lists the zone's other literal rules, which then also
 *    receive their own `+<tag>` addresses;
 * 6. one literal rule `qa@<domain>` → the Worker (`wrangler email routing rules create`).
 *    The zone's catch-all is never read for writing, never changed.
 *
 * Wrangler has no command for steps 4, 5 and the preflight's reads, so they call the Email
 * Routing API with Wrangler's own login (`wrangler auth token`) or CLOUDFLARE_API_TOKEN.
 * `--dry-run` calls nothing and changes no file: it prints every command and API call.
 * Guide: docs/guides/how-to-qa-a-deployment.md#the-qa-inbox
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
  databaseIdFrom,
  databaseIdFromCreate,
  describeRouting,
  expectedRecords,
  inboxMailbox,
  isSubdomainOf,
  QA_INBOX_DATABASE,
  QA_INBOX_WORKER,
  type RoutingRule,
  type RoutingSettings,
  rulePlan,
  rulesGainingSubaddresses,
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
    preflight: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "enable-zone-routing": { type: "boolean", default: false },
  },
});
const preflightOnly = values.preflight ?? false;
const dryRun = (values["dry-run"] ?? false) && !preflightOnly;
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
const mailbox = inboxMailbox(domain);

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

/** One Email Routing API call; with --dry-run it only prints it (and calls nothing). */
async function api(
  method: "GET" | "POST" | "PUT",
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

interface ZoneState {
  readonly zoneId: string;
  readonly settings: RoutingSettings | null;
  readonly rules: RoutingRule[];
  readonly subdomainReady: boolean;
}

/** Every rule of the zone (the API pages them, 50 at a time). */
async function listRules(zoneId: string): Promise<RoutingRule[]> {
  const rules: RoutingRule[] = [];
  for (let page = 1; page <= 20; page++) {
    const listed = await api(
      "GET",
      `/zones/${zoneId}/email/routing/rules?per_page=50&page=${page}`
    );
    if (!listed.ok) fail(`could not list the rules: ${apiErrors(listed.json)}`);
    const batch = (listed.json.result as RoutingRule[] | undefined) ?? [];
    rules.push(...batch);
    if (batch.length < 50) break;
  }
  return rules;
}

/** Step 0: the zone's Email Routing as it is, from GET requests only. */
async function readZoneState(): Promise<ZoneState> {
  const zones = await api("GET", `/zones?name=${encodeURIComponent(zone)}`);
  const zoneId =
    (zones.json.result as { id: string }[] | undefined)?.[0]?.id ??
    fail(`zone ${zone} not found in this account: ${apiErrors(zones.json)}`);
  const settings = await api("GET", `/zones/${zoneId}/email/routing`);
  const catchAll = await api(
    "GET",
    `/zones/${zoneId}/email/routing/rules/catch_all`
  );
  const rules = await listRules(zoneId);
  const dns = await api(
    "GET",
    `/zones/${zoneId}/email/routing/dns?subdomain=${encodeURIComponent(domain)}`
  );
  // Where the apex's mail goes today: what turning on zone-wide routing would replace.
  const apexMx = await api(
    "GET",
    `/zones/${zoneId}/dns_records?type=MX&name=${encodeURIComponent(zone)}`
  );
  const state: ZoneState = {
    zoneId,
    settings: settings.ok
      ? ((settings.json.result as RoutingSettings | undefined) ?? null)
      : null,
    rules,
    subdomainReady: subdomainRoutingReady(dns.json),
  };
  console.log("");
  for (const line of describeRouting({
    zone,
    settings: state.settings,
    catchAll: catchAll.ok
      ? ((catchAll.json.result as RoutingRule | undefined) ?? null)
      : null,
    rules,
    subdomain: domain,
    subdomainReady: state.subdomainReady,
  }))
    console.log(`  ${line}`);
  const mx = apexMx.ok
    ? ((apexMx.json.result as { content?: string; priority?: number }[]) ?? [])
    : null;
  console.log(
    `  ${zone} MX records: ${mx === null ? "not readable with this login" : mx.length ? mx.map((record) => `${record.priority ?? "?"} ${record.content ?? "?"}`).join(", ") : "none"}`
  );
  const plan = rulePlan(rules, mailbox, QA_INBOX_WORKER);
  console.log(`  Rule ${mailbox}: ${plan.action} (${plan.reason})`);
  if (state.settings?.support_subaddress !== true) {
    const gaining = rulesGainingSubaddresses(rules, mailbox);
    console.log(
      gaining.length
        ? `  Turning subaddressing on also delivers <local>+<tag>@ to these existing rules (until now such mail went to the catch-all): ${gaining.join(", ")}`
        : "  Turning subaddressing on changes no existing rule (none is a literal address)."
    );
  }
  return state;
}

console.log(
  `QA inbox: ${QA_INBOX_WORKER}, mail to ${mailbox} and qa+<tag>@${domain} (zone ${zone})${dryRun ? " — dry run, nothing is called or changed" : preflightOnly ? " — preflight, read-only" : ""}`
);

// 0. Read-only preflight.
console.log("\n0. Preflight (read-only)");
let state: ZoneState | null = null;
if (dryRun) {
  console.log(
    `  (dry run) GET /zones?name=${zone}, /email/routing, /email/routing/rules/catch_all, /email/routing/rules, /email/routing/dns?subdomain=${domain}: prints routing on/off, subaddressing, the catch-all and every rule`
  );
} else {
  state = await readZoneState();
  if (preflightOnly) {
    console.log("\nPreflight only: nothing was changed.");
    process.exit(0);
  }
  // Off for the zone and the subdomain not set up yet: enabling it here could add MX
  // records to the apex. The owner decides: the dashboard's Settings > Subdomains adds the
  // subdomain alone (then re-run: its records are found and nothing at the apex changes),
  // or --enable-zone-routing.
  if (
    !state.settings?.enabled &&
    !state.subdomainReady &&
    !values["enable-zone-routing"]
  ) {
    fail(
      `Email Routing is off for the zone ${zone} and ${domain} has no Email Routing records yet. Nothing was changed. Either add ${domain} in the dashboard (Email > Email Routing > Settings > Subdomains) and re-run, or, if replacing the MX records of ${zone} itself is fine, re-run with --enable-zone-routing.`
    );
  }
  const plan = rulePlan(state.rules, mailbox, QA_INBOX_WORKER);
  if (plan.action === "conflict") fail(plan.reason);
}

// 1. D1 database and migrations.
console.log("\n1. D1 database");
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
const zoneId = state?.zoneId ?? "<zone id>";
if (dryRun) {
  console.log(
    `  (dry run) if Email Routing is off for ${zone}: stop, unless --enable-zone-routing (then: wrangler email routing enable ${zone})`
  );
} else if (!state?.settings?.enabled && !state?.subdomainReady) {
  const enabled = inboxWrangler(["email", "routing", "enable", zone]);
  if (!enabled.ok)
    fail(enabled.stderr.trim() || "enabling Email Routing failed");
}
if (state?.subdomainReady) {
  console.log(`  ✓ MX and SPF records for ${domain} are in place`);
} else {
  const added = await api("POST", `/zones/${zoneId}/email/routing/dns`, {
    name: domain,
  });
  if (!added.ok) fail(`could not enable ${domain}: ${apiErrors(added.json)}`);
  console.log(`  ${dryRun ? "(dry run) creates" : "✓ created"}:`);
  for (const record of expectedRecords(domain)) console.log(`    ${record}`);
}

// 5. Subaddressing, so qa+<tag>@ reaches the qa@ rule.
console.log("\n5. Subaddressing");
if (state?.settings?.support_subaddress === true) {
  console.log("  ✓ already on for the zone");
} else {
  const set = await api("PUT", `/zones/${zoneId}/email/routing`, {
    support_subaddress: true,
  });
  if (!set.ok) fail(`could not turn subaddressing on: ${apiErrors(set.json)}`);
  if (!dryRun) console.log("  ✓ on for the zone");
}

// 6. The one rule: qa@<domain> → the Worker. The catch-all is left as it is.
console.log(`\n6. Rule ${mailbox}`);
const plan = state
  ? rulePlan(state.rules, mailbox, QA_INBOX_WORKER)
  : { action: "create" as const, reason: "unless it exists already" };
if (plan.action === "keep") {
  console.log(`  ✓ ${plan.reason}`);
} else {
  const rule = inboxWrangler([
    "email",
    "routing",
    "rules",
    "create",
    zone,
    "--name",
    "QA inbox",
    "--match-type",
    "literal",
    "--match-field",
    "to",
    "--match-value",
    mailbox,
    "--action-type",
    "worker",
    "--action-value",
    QA_INBOX_WORKER,
  ]);
  if (!rule.ok) fail(rule.stderr.trim() || "creating the rule failed");
}

console.log(
  dryRun
    ? "\nDry run: nothing was called or changed."
    : `\nDone. Send a test mail to qa+20260101test-check@${domain} and read it with:\n  curl -H "Authorization: Bearer $QA_INBOX_TOKEN" "${url ?? "<QA_INBOX_URL>"}/messages?to=qa%2B20260101test-check%40${domain}"`
);
