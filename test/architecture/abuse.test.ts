/**
 * Abuse protection covers the whole API (docs/architecture/overview.md#abuse-protection):
 * every tRPC mutation and every endpoint under apps/web/src/pages has a rate-limit policy
 * or a RATE_LIMIT_EXEMPT entry with a reason, and every binding the catalog names exists
 * in every environment of wrangler.jsonc with the catalog's limit and period.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { AnyProcedure } from "@trpc/server";
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { appRouter } from "@/server/trpc/router";

import {
  mutationPolicy,
  PROCEDURE_POLICIES,
  RATE_LIMIT_EXEMPT,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  ROUTE_POLICIES,
} from "../../packages/features/src";
import { ROOT, read } from "./repo";

const procedures = appRouter._def.procedures as unknown as Record<
  string,
  AnyProcedure
>;
const mutations = Object.entries(procedures)
  .filter(([, procedure]) => procedure._def.type === "mutation")
  .map(([path]) => path);

const PAGES = "apps/web/src/pages/";
/** Endpoint files under src/pages, including dot folders such as .well-known. */
function endpointFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return endpointFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}
const endpoints = endpointFiles(join(ROOT, PAGES)).map((path) =>
  relative(join(ROOT, PAGES), path)
);

type Block = Record<string, unknown>;
interface RateLimitBinding {
  readonly name: string;
  readonly namespace_id: string;
  readonly simple: { readonly limit: number; readonly period: number };
}
const config = parse(read("apps/web/wrangler.jsonc")) as Block & {
  env?: Record<string, Block>;
};
const environments: [string, Block][] = [
  ["top level", config],
  ...Object.entries(config.env ?? {}),
];
const ratelimitsOf = (block: Block) =>
  (block.ratelimits as RateLimitBinding[] | undefined) ?? [];

const policies = Object.entries(RATE_LIMIT_POLICIES) as [
  string,
  RateLimitPolicy,
][];
const edgePolicies = policies.filter(([, p]) => p.enforcer === "edge");

describe("abuse protection coverage", () => {
  it("finds mutations and endpoints", () => {
    expect(mutations.length).toBeGreaterThan(0);
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it.each(mutations)(
    "mutation %s is limited or exempt with a reason",
    (path) => {
      const policy = mutationPolicy(path);
      if (policy === null) {
        expect(RATE_LIMIT_EXEMPT[path]?.trim().length).toBeGreaterThan(10);
        return;
      }
      expect(RATE_LIMIT_POLICIES[policy].enforcer).toBe("edge");
    }
  );

  it("names only real mutations in PROCEDURE_POLICIES", () => {
    const unknown = Object.keys(PROCEDURE_POLICIES).filter(
      (path) => !mutations.includes(path)
    );
    expect(unknown).toEqual([]);
  });

  it.each(endpoints)("endpoint %s has a policy or an exemption", (file) => {
    const limited = file in ROUTE_POLICIES;
    const exempt = file in RATE_LIMIT_EXEMPT;
    expect(
      limited !== exempt,
      "add it to ROUTE_POLICIES or RATE_LIMIT_EXEMPT (not both)"
    ).toBe(true);
    if (exempt)
      expect(RATE_LIMIT_EXEMPT[file]?.trim().length).toBeGreaterThan(10);
  });

  it.each(Object.entries(ROUTE_POLICIES))(
    "%s applies its policies",
    (file, ids) => {
      // The route itself, or the handler it delegates to, names each policy.
      const source = [read(`${PAGES}${file}`)];
      if (file === "mcp.ts")
        source.push(read("apps/web/src/server/mcp/handler.ts"));
      for (const id of ids) expect(source.join("\n")).toContain(`"${id}"`);
    }
  );

  it("lists no stale route or procedure entries", () => {
    const stale = [
      ...Object.keys(ROUTE_POLICIES),
      ...Object.keys(RATE_LIMIT_EXEMPT),
    ].filter((key) => !endpoints.includes(key) && !mutations.includes(key));
    expect(stale).toEqual([]);
  });
});

describe("rate-limit bindings in wrangler.jsonc", () => {
  it.each(environments)(
    "%s declares every catalog binding with the catalog's limit and period",
    (_, block) => {
      const bindings = new Map(ratelimitsOf(block).map((b) => [b.name, b]));
      for (const [id, policy] of edgePolicies) {
        const binding = bindings.get(policy.binding ?? "");
        expect(binding, `${id}: missing ${policy.binding}`).toBeDefined();
        expect(binding?.simple, id).toEqual({
          limit: policy.limit,
          period: policy.periodSeconds,
        });
      }
    }
  );

  it.each(environments)(
    "%s declares no binding the catalog does not use",
    (_, block) => {
      const used = new Set(edgePolicies.map(([, p]) => p.binding));
      expect(ratelimitsOf(block).filter((b) => !used.has(b.name))).toEqual([]);
    }
  );

  it("gives every binding in every environment its own namespace_id", () => {
    const ids = environments.flatMap(([, block]) =>
      ratelimitsOf(block).map((b) => b.namespace_id)
    );
    expect(ids.every((id) => /^[1-9]\d*$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
