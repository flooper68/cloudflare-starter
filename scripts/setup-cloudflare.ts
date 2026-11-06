/**
 * `bun run setup:cloudflare [--env develop|staging|production|all] [--jurisdiction eu] [--namespace-base <n>] [--dry-run]`
 *
 * Creates the web Worker's Cloudflare resources for an environment, named as in
 * apps/web/wrangler.jsonc: the D1 database (its id is written back into the config),
 * the R2 bucket (with `--jurisdiction`, also written into its binding), the queue and its
 * dead-letter queue (with the maximum message retention, 14 days, set again on every run).
 * The Analytics Engine metrics dataset needs no step (the first write creates it); it is
 * listed. Workers Rate Limiting needs no resource, but its namespace_ids are account-wide:
 * the script gives the environment ids from the project's own block when they are still
 * the starter's (cloudflare-plan.ts; `--namespace-base` picks the block). Re-runnable:
 * existing resources are kept. Needs `bunx wrangler login` (or CLOUDFLARE_API_TOKEN) first.
 */
import { parseArgs } from "node:util";

import {
  bucketJurisdictionPlan,
  describeIds,
  planNamespaceIds,
  R2_JURISDICTIONS,
  type RateLimitBinding,
} from "./cloudflare-plan";
import {
  ENVIRONMENTS,
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
    "namespace-base": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
if (
  values.jurisdiction &&
  !(R2_JURISDICTIONS as readonly string[]).includes(values.jurisdiction)
) {
  fail(
    `Unknown jurisdiction "${values.jurisdiction}" (${R2_JURISDICTIONS.join(" | ")})`
  );
}
const jurisdiction = values.jurisdiction
  ? ["--jurisdiction", values.jurisdiction]
  : [];
const namespaceBase =
  values["namespace-base"] === undefined
    ? undefined
    : Number(values["namespace-base"]);
if (
  namespaceBase !== undefined &&
  !(
    Number.isSafeInteger(namespaceBase) &&
    namespaceBase > 0 &&
    namespaceBase + 1000 < 2 ** 31
  )
) {
  fail("--namespace-base must be a positive integer below 2147482647");
}

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

interface R2Entry {
  readonly bucket_name: string;
  readonly jurisdiction?: string;
}

function setupBucket(env: Environment, index: number, entry: R2Entry) {
  const name = entry.bucket_name;
  console.log(`R2 ${name}`);
  const plan = bucketJurisdictionPlan(entry, values.jurisdiction);
  if (plan.action === "conflict") fail(`${name}: ${plan.message}`);
  // The bucket's own jurisdiction: a jurisdictional bucket is invisible without it.
  const where =
    (plan.action === "write" ? plan.jurisdiction : undefined) ??
    entry.jurisdiction;
  const scope = where ? ["--jurisdiction", where] : [];
  if (!dryRun && wrangler(["r2", "bucket", "info", name, ...scope]).ok) {
    console.log("  = exists");
  } else {
    const created = wrangler(["r2", "bucket", "create", name, ...scope], {
      dryRun,
    });
    if (!created.ok) fail(created.stderr || created.stdout);
    if (!dryRun) console.log("  + created");
  }
  if (plan.action === "write") {
    setWranglerValue(
      envPath(env, "r2_buckets", index, "jurisdiction"),
      plan.jurisdiction,
      dryRun
    );
    if (!dryRun)
      console.log(
        `  ✓ jurisdiction "${plan.jurisdiction}" written to wrangler.jsonc`
      );
  }
}

/**
 * namespace_ids are account-wide: two Workers whose bindings share an id share counters.
 * Keeps the environment's ids when they are the project's own, else writes ids from the
 * project's block (cloudflare-plan.ts).
 */
function setupRateLimits(env: Environment) {
  const current = readWranglerConfig();
  const bindings =
    (envBlock(current, env).ratelimits as RateLimitBinding[] | undefined) ?? [];
  if (bindings.length === 0) return;
  const otherIds = ENVIRONMENTS.filter((other) => other !== env).flatMap(
    (other) =>
      (
        (envBlock(current, other).ratelimits as
          | RateLimitBinding[]
          | undefined) ?? []
      ).map((binding) => binding.namespace_id ?? "")
  );
  const plan = planNamespaceIds({
    workerName: String(current.name ?? ""),
    env,
    bindings,
    otherIds,
    base: namespaceBase,
    force: namespaceBase !== undefined,
  });
  const ids = plan.ids.map((entry) => entry.id);
  console.log(`Rate limiting namespaces (${bindings.length} bindings)`);
  if (plan.action === "keep") {
    console.log(
      `  = ${describeIds(ids)} kept (must be unused by every other Worker in the account)`
    );
    return;
  }
  console.log(`  ~ ${plan.reasons.join("; ")}`);
  if (ids.some((id) => otherIds.includes(id)))
    fail(
      `the new ids ${describeIds(ids)} collide with another environment: pick a block with --namespace-base`
    );
  plan.ids.forEach((entry, index) => {
    if (bindings[index]?.namespace_id === entry.id) return;
    setWranglerValue(
      envPath(env, "ratelimits", index, "namespace_id"),
      entry.id,
      dryRun
    );
  });
  if (!dryRun)
    console.log(
      `  ✓ namespace_ids ${describeIds(ids)} written to wrangler.jsonc`
    );
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
  ((block.r2_buckets as R2Entry[] | undefined) ?? []).forEach(
    (bucket, index) => {
      setupBucket(env, index, bucket);
    }
  );
  for (const queue of queuePlan(block as Parameters<typeof queuePlan>[0])) {
    setupQueue(queue);
  }

  // Workers Rate Limiting needs no resource, only account-wide unique namespace_ids.
  setupRateLimits(env);
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
  // Analytics Engine datasets have no create command: the first write after deploy
  // creates them (docs/guides/how-to-setup-metrics-and-tracing.md).
  for (const dataset of (block.analytics_engine_datasets as
    | { dataset: string }[]
    | undefined) ?? []) {
    console.log(
      `Analytics Engine ${dataset.dataset}\n  = created on the first write (nothing to do)`
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
