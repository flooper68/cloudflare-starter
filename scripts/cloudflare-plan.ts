/**
 * Pure planning helpers of `setup:cloudflare` (and the namespace check of `doctor`): which
 * Workers Rate Limiting `namespace_id`s an environment should use, and the R2 jurisdiction
 * a bucket entry needs. No I/O, tested in cloudflare-plan.test.ts.
 */
import type { Environment } from "./lib";

/** The web Worker's name in the starter itself (apps/web/wrangler.jsonc `name`). */
export const STARTER_WORKER_NAME = "cloudflare-starter-web";

/**
 * namespace_ids the starter has shipped in wrangler.jsonc, now or in the past. A project
 * built from the starter that still uses them shares its counters with every other
 * project in the same account that does too, so `setup:cloudflare` replaces them.
 */
export const STARTER_SHIPPED_NAMESPACE_IDS: ReadonlySet<string> = new Set(
  [1000, 2000, 3000, 7000, 8000, 9000].flatMap((base) =>
    Array.from({ length: 10 }, (_, index) => String(base + index + 1))
  )
);

/** Offset of each environment inside a project's block; up to 99 bindings each. */
export const ENVIRONMENT_NAMESPACE_OFFSET: Readonly<
  Record<Environment, number>
> = { develop: 0, staging: 100, production: 200 };

/** 32-bit FNV-1a of a string. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of new TextEncoder().encode(text)) {
    hash ^= char;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * First id of a project's block of 1000 namespace ids, derived from the Worker name:
 * one of 900,000 blocks between 100,000,000 and 999,999,999 (well under 2^31). Two
 * projects get the same block only by a hash collision; Cloudflare offers no call to
 * list the namespaces in use, so that residual risk is documented, not checked.
 */
export function projectNamespaceBase(workerName: string): number {
  return ((fnv1a(workerName) % 900_000) + 100_000) * 1000;
}

export interface RateLimitBinding {
  readonly name: string;
  readonly namespace_id?: string;
}

export interface NamespacePlan {
  readonly action: "keep" | "assign";
  /** Why the ids are (re)assigned; empty when kept. */
  readonly reasons: readonly string[];
  /** The ids the environment ends up with, in binding order. */
  readonly ids: readonly { readonly name: string; readonly id: string }[];
}

/**
 * The namespace_ids of one environment's `ratelimits`. Kept when they are valid, unique
 * in the file and the project's own; assigned from the project's block (base + the
 * environment's offset + 1, 2, … in binding order) when an id is missing or invalid,
 * used twice in the file, still one the starter ships while the Worker has been renamed,
 * or when `force` (an explicit `--namespace-base`) asks for it.
 */
export function planNamespaceIds(input: {
  readonly workerName: string;
  readonly env: Environment;
  readonly bindings: readonly RateLimitBinding[];
  /** namespace_ids of the other environments in the file. */
  readonly otherIds: readonly string[];
  /** Explicit first id of the project's block (default: from the Worker name). */
  readonly base?: number;
  readonly force?: boolean;
}): NamespacePlan {
  const current = input.bindings.map((binding) => binding.namespace_id ?? "");
  const reasons: string[] = [];
  if (input.force) reasons.push("an explicit --namespace-base was given");
  if (current.some((id) => !/^[1-9]\d*$/.test(id)))
    reasons.push("a namespace_id is missing or not a positive integer");
  const others = new Set(input.otherIds);
  if (
    current.some((id, index) => current.indexOf(id) !== index || others.has(id))
  )
    reasons.push("a namespace_id is used twice in wrangler.jsonc");
  if (
    input.workerName !== STARTER_WORKER_NAME &&
    current.some((id) => STARTER_SHIPPED_NAMESPACE_IDS.has(id))
  )
    reasons.push(
      "the ids are the starter's own, shared with every project that kept them"
    );

  if (reasons.length === 0) {
    return {
      action: "keep",
      reasons,
      ids: input.bindings.map((binding, index) => ({
        name: binding.name,
        id: current[index] as string,
      })),
    };
  }
  const first =
    (input.base ?? projectNamespaceBase(input.workerName)) +
    ENVIRONMENT_NAMESPACE_OFFSET[input.env];
  return {
    action: "assign",
    reasons,
    ids: input.bindings.map((binding, index) => ({
      name: binding.name,
      id: String(first + index + 1),
    })),
  };
}

/** "9001–9010" for consecutive ids, else a comma list. */
export function describeIds(ids: readonly string[]): string {
  if (ids.length === 0) return "none";
  const numbers = ids.map(Number).sort((a, b) => a - b);
  const consecutive = numbers.every(
    (value, index) => index === 0 || value === (numbers[index - 1] ?? 0) + 1
  );
  return consecutive && numbers.length > 1
    ? `${numbers[0]}–${numbers[numbers.length - 1]}`
    : numbers.join(", ");
}

export const R2_JURISDICTIONS = ["eu", "fedramp"] as const;

/**
 * What to do with the `jurisdiction` of an R2 bucket entry in wrangler.jsonc for this run's
 * `--jurisdiction`. A bucket created in a jurisdiction is reachable only with it: without
 * `"jurisdiction"` in the binding the Worker looks for a bucket that does not exist.
 */
export function bucketJurisdictionPlan(
  entry: { readonly jurisdiction?: string },
  jurisdiction: string | undefined
):
  | { readonly action: "keep" }
  | { readonly action: "write"; readonly jurisdiction: string }
  | { readonly action: "conflict"; readonly message: string } {
  if (!jurisdiction || entry.jurisdiction === jurisdiction)
    return { action: "keep" };
  if (entry.jurisdiction)
    return {
      action: "conflict",
      message: `the bucket is configured in jurisdiction "${entry.jurisdiction}", not "${jurisdiction}"; a bucket cannot move, create one under a new name`,
    };
  return { action: "write", jurisdiction };
}
