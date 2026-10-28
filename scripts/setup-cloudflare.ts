/**
 * `bun run setup:cloudflare [--env develop|staging|production|all] [--jurisdiction eu] [--dry-run]`
 *
 * Creates the web Worker's Cloudflare resources for an environment, named as in
 * apps/web/wrangler.jsonc: the D1 database (its id is written back into the config),
 * the R2 bucket, the queue and its dead-letter queue. Re-runnable: existing resources
 * are kept. Needs `bunx wrangler login` (or CLOUDFLARE_API_TOKEN) first.
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
interface QueueConsumer {
  readonly queue: string;
  readonly dead_letter_queue?: string;
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

function setupQueue(name: string) {
  console.log(`Queue ${name}`);
  if (!dryRun && wrangler(["queues", "info", name]).ok) {
    console.log("  = exists");
    return;
  }
  const created = wrangler(["queues", "create", name], { dryRun });
  if (!created.ok) fail(created.stderr || created.stdout);
  if (!dryRun) console.log("  + created");
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
  const queues = block.queues as { consumers?: QueueConsumer[] } | undefined;
  for (const consumer of queues?.consumers ?? []) {
    setupQueue(consumer.queue);
    if (consumer.dead_letter_queue) setupQueue(consumer.dead_letter_queue);
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
