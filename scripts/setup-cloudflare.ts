/**
 * `bun run setup:cloudflare [--env develop|staging|production|all] [--jurisdiction eu] [--dry-run]`
 *
 * Creates the web Worker's Cloudflare resources for an environment, named as in
 * apps/web/wrangler.jsonc: the D1 database (its id is written back into the config),
 * the R2 bucket, the queue and its dead-letter queue (with the maximum message retention,
 * 14 days, set again on every run). Re-runnable: existing resources are kept. Needs
 * `bunx wrangler login` (or CLOUDFLARE_API_TOKEN) first.
 */
import { parseArgs } from "node:util";

import {
  type Environment,
  envBlock,
  envPath,
  fail,
  PLACEHOLDER_ID,
  parseEnvironments,
  readWranglerConfig,
  setWranglerValue,
  wrangler,
} from "./lib";
import { type PlannedQueue, queuePlan } from "./queue-plan";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    jurisdiction: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const jurisdiction = values.jurisdiction
  ? ["--jurisdiction", values.jurisdiction]
  : [];

interface D1Entry {
  readonly database_name: string;
  readonly database_id: string;
}

function setupD1(env: Environment, entry: D1Entry) {
  console.log(`D1 ${entry.database_name}`);
  let info = dryRun
    ? null
    : wrangler(["d1", "info", entry.database_name, "--json"]);
  if (!dryRun && !info?.ok) {
    const created = wrangler([
      "d1",
      "create",
      entry.database_name,
      ...jurisdiction,
    ]);
    if (!created.ok) fail(created.stderr || created.stdout);
    console.log("  + created");
    info = wrangler(["d1", "info", entry.database_name, "--json"]);
  } else if (dryRun) {
    wrangler(["d1", "create", entry.database_name, ...jurisdiction], {
      dryRun,
    });
  } else {
    console.log("  = exists");
  }

  const id = dryRun
    ? "<new id>"
    : ((JSON.parse(info?.stdout ?? "{}") as { uuid?: string }).uuid ?? "");
  if (!dryRun && !id) fail(`Could not read the id of ${entry.database_name}`);
  if (id !== entry.database_id) {
    setWranglerValue(
      envPath(env, "d1_databases", 0, "database_id"),
      id,
      dryRun
    );
    if (!dryRun) console.log(`  ✓ database_id ${id} written to wrangler.jsonc`);
  }
}

function setupBucket(name: string) {
  console.log(`R2 ${name}`);
  if (!dryRun && wrangler(["r2", "bucket", "info", name]).ok) {
    console.log("  = exists");
    return;
  }
  const created = wrangler(["r2", "bucket", "create", name, ...jurisdiction], {
    dryRun,
  });
  if (!created.ok) fail(created.stderr || created.stdout);
  if (!dryRun) console.log("  + created");
}

function setupQueue(queue: PlannedQueue) {
  console.log(`Queue ${queue.name} (${queue.role})`);
  const retention =
    queue.messageRetentionSeconds === undefined
      ? []
      : [
          "--message-retention-period-secs",
          String(queue.messageRetentionSeconds),
        ];
  const exists = !dryRun && wrangler(["queues", "info", queue.name]).ok;
  if (exists && retention.length === 0) {
    console.log("  = exists");
    return;
  }
  let result = exists
    ? wrangler(["queues", "update", queue.name, ...retention])
    : wrangler(["queues", "create", queue.name, ...retention], { dryRun });
  let retentionSet = result.ok;
  if (!result.ok && retention.length > 0) {
    // Workers Free fixes retention at 24 hours and rejects the setting: keep the queue
    // (created without it) and go on with the other resources.
    console.warn(
      `  ! message retention ${queue.messageRetentionSeconds} s was rejected (Workers Free fixes it at 24 hours; docs/guides/how-to-add-background-jobs.md#dead-letter-queue):\n    ${(result.stderr || result.stdout).trim()}`
    );
    result = exists
      ? { ok: true, stdout: "", stderr: "" }
      : wrangler(["queues", "create", queue.name]);
    retentionSet = false;
  }
  if (!result.ok) fail(result.stderr || result.stdout);
  if (!dryRun) {
    if (!exists) console.log("  + created");
    if (retentionSet && retention.length > 0) {
      console.log(`  ✓ message retention ${queue.messageRetentionSeconds} s`);
    }
  }
}

const config = readWranglerConfig();
for (const env of parseEnvironments(values.env)) {
  console.log(`\n== ${env} ==`);
  const block = envBlock(config, env);

  for (const entry of (block.d1_databases as D1Entry[] | undefined) ?? []) {
    setupD1(env, entry);
  }
  for (const bucket of (block.r2_buckets as
    | { bucket_name: string }[]
    | undefined) ?? []) {
    setupBucket(bucket.bucket_name);
  }
  for (const queue of queuePlan(block as Parameters<typeof queuePlan>[0])) {
    setupQueue(queue);
  }

  // Workers Rate Limiting needs no resource: the namespace_id in wrangler.jsonc is enough.
  const vars = (block.vars as Record<string, string> | undefined) ?? {};
  if (vars.TURNSTILE === "on") {
    console.log(
      [
        "Turnstile (manual, in the dashboard: no API call from this script)",
        "  1. Cloudflare dashboard > Turnstile > Add widget, mode Managed.",
        `  2. Hostnames: this environment's domain (${env}); not localhost.`,
        `  3. Put the site key in TURNSTILE_SITE_KEY of ${env === "develop" ? "the top-level vars" : `env.${env}.vars`} in apps/web/wrangler.jsonc.`,
        `  4. Store the secret key: bun run setup:secrets --env ${env} (TURNSTILE_SECRET_KEY).`,
        "  Guide: docs/guides/how-to-configure-abuse-protection.md",
      ].join("\n")
    );
  }
}

const remaining = parseEnvironments(values.env).filter(
  (env) =>
    (
      envBlock(readWranglerConfig(), env).d1_databases as D1Entry[] | undefined
    )?.[0]?.database_id === PLACEHOLDER_ID
);
console.log(
  dryRun
    ? "\nDry run: nothing was created or changed."
    : remaining.length
      ? `\nStill a placeholder database_id in: ${remaining.join(", ")}`
      : "\nDone. Next: bun run setup:secrets --env <env>, then migrate and deploy (docs/guides/how-to-setup-web-app.md)."
);
