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
  WEB_ANALYTICS_SITE_TAG:
    "optional, per environment: the Web Analytics site of that hostname (only where WEB_ANALYTICS=cloudflare and the admin Analytics page should show it)",
  ADMIN_PORTAL:
    "written by setup:auth; deliberately absent until the owner chooses (no default)",
  TWO_FACTOR: "written by setup:auth; explicit enrollment policy",
  TWO_FACTOR_EMAIL_OTP: "written by setup:auth; optional email recovery",
  TWO_FACTOR_TRUSTED_DEVICE_DAYS: "written by setup:auth; bounded device trust",
  PASSKEYS: "written by setup:auth; explicit passkey choice",
  BILLING:
    "written by setup:auth; deliberately absent until the owner chooses off, manual or provider",
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
    workflows: names("workflows", "binding"),
    services: names("services", "binding"),
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

/**
 * The container workflow demo: a Workflow per environment (names are account-wide) and a
 * service binding to the pi container Worker of the same environment, which has no public
 * URL and the demo's cost limits (docs/guides/how-to-run-container-workflows.md).
 */
describe("container workflow demo wiring", () => {
  const container = parse(read("apps/container/wrangler.jsonc")) as Block & {
    env?: Record<string, Block>;
  };
  const web: [string, Block][] = [
    ["develop", config],
    ...Object.entries(config.env ?? {}),
  ];
  const containerOf = (env: string): Block =>
    env === "develop" ? container : (container.env?.[env] ?? {});
  const containerName = (env: string) =>
    env === "develop"
      ? String(container.name)
      : `${String(container.name)}-${env}`;

  it("names one Workflow per environment, bound as CONTAINER_RUN_WORKFLOW to ContainerRunWorkflow", () => {
    const names = web.map(([, block]) => {
      const [workflow] = (block.workflows as Block[] | undefined) ?? [];
      expect(workflow).toMatchObject({
        binding: "CONTAINER_RUN_WORKFLOW",
        class_name: "ContainerRunWorkflow",
      });
      return workflow?.name;
    });
    expect(new Set(names).size).toBe(web.length);
  });

  it.each(web)(
    "%s binds PI_CONTAINER_SERVICE to the container Worker of the same environment",
    (env, block) => {
      expect(block.services).toEqual([
        { binding: "PI_CONTAINER_SERVICE", service: containerName(env) },
      ]);
    }
  );

  it.each(web.map(([env]) => env))(
    "the %s container Worker has no public URL, the smallest instance and at most two instances",
    (env) => {
      const block = containerOf(env);
      expect(block.workers_dev).toBe(false);
      expect(block.preview_urls).toBe(false);
      expect(block.containers).toEqual([
        expect.objectContaining({
          class_name: "PiContainer",
          instance_type: "lite",
          max_instances: 2,
        }),
      ]);
    }
  );

  it("keeps PI_INSTANCES equal to max_instances", () => {
    expect(read("apps/container/src/index.ts")).toContain(
      "export const PI_INSTANCES = 2;"
    );
  });
});
