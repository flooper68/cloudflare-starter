/**
 * Bindings are not inherited by `env.*` in wrangler.jsonc: every environment must declare
 * the same bindings and vars as the top level (develop), and the same observability and
 * version_metadata settings (logs, traces and the release id behave alike everywhere).
 */
import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import { read } from "./repo";

/**
 * Vars a setup script writes per environment, with the reason they may differ between
 * environments (or be missing until the script has run for one).
 */
const SETUP_WRITTEN_VARS: Readonly<Record<string, string>> = {
  EMAIL_FROM: "written by setup:email once a sender domain is onboarded",
  WORKSPACE_MODE:
    "written by setup:auth; deliberately absent until the owner chooses (no default)",
  SIGN_UP: "written by setup:auth; deliberately absent until the owner chooses",
  SIGN_UP_DOMAINS: "written by setup:auth",
  BOOTSTRAP_ADMIN_EMAIL: "written by setup:auth",
  ANALYTICS:
    "written by setup:analytics; deliberately absent until the owner chooses whether an environment collects product events",
  WEB_ANALYTICS:
    "written by setup:analytics; deliberately absent until the owner chooses",
  WEB_ANALYTICS_TOKEN:
    "written by setup:analytics: the Web Analytics site token differs per environment",
};

type Block = Record<string, unknown>;
const config = parse(read("apps/web/wrangler.jsonc")) as Block & {
  env?: Record<string, Block>;
};

function bindings(block: Block): Record<string, string[]> {
  const names = (key: string, field: string) =>
    ((block[key] as Block[] | undefined) ?? [])
      .map((entry) => String(entry[field]))
      .sort();
  const queues = (block.queues as Record<string, Block[]> | undefined) ?? {};
  return {
    d1: names("d1_databases", "binding"),
    r2: names("r2_buckets", "binding"),
    sendEmail: names("send_email", "name"),
    ratelimits: names("ratelimits", "name"),
    analyticsEngine: names("analytics_engine_datasets", "binding"),
    queueProducers: (queues.producers ?? [])
      .map((q) => String(q.binding))
      .sort(),
    queueConsumers: (queues.consumers ?? []).map(() => "consumer"),
    crons: block.triggers ? ["crons"] : [],
    vars: Object.keys((block.vars as Block | undefined) ?? {})
      .filter((name) => !(name in SETUP_WRITTEN_VARS))
      .sort(),
  };
}

describe("wrangler.jsonc", () => {
  const environments = Object.entries(config.env ?? {});

  it("defines staging and production", () => {
    expect(environments.map(([name]) => name).sort()).toEqual([
      "production",
      "staging",
    ]);
  });

  it("declares observability (logs, invocation logs, traces) and version_metadata at the top level", () => {
    expect(config.observability).toMatchObject({
      enabled: true,
      logs: { enabled: true, invocation_logs: true },
      traces: { enabled: true },
    });
    expect(config.version_metadata).toEqual({ binding: "CF_VERSION_METADATA" });
  });

  it.each(environments)(
    "env.%s declares the same observability and version_metadata as the top level",
    (_, block) => {
      expect(block.observability).toEqual(config.observability);
      expect(block.version_metadata).toEqual(config.version_metadata);
    }
  );

  it("binds the METRICS_DATASET Analytics Engine dataset, one dataset per environment", () => {
    const datasets = [config, ...environments.map(([, block]) => block)].map(
      (block) =>
        ((block.analytics_engine_datasets as Block[] | undefined) ?? []).find(
          (entry) => entry.binding === "METRICS_DATASET"
        )?.dataset
    );
    expect(datasets.every((name) => typeof name === "string")).toBe(true);
    expect(new Set(datasets).size).toBe(datasets.length);
  });

  it.each(environments)(
    "env.%s declares every binding and var of the top level",
    (_, block) => {
      expect(bindings(block)).toEqual(bindings(config));
    }
  );
});
