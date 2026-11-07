import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  bucketJurisdictionPlan,
  describeIds,
  planNamespaceIds,
  projectNamespaceBase,
  STARTER_SHIPPED_NAMESPACE_IDS,
  STARTER_WORKER_NAME,
} from "./cloudflare-plan";
import { ROOT } from "./lib";

const bindings = (...ids: string[]) =>
  ids.map((id, index) => ({ name: `RL_${index}`, namespace_id: id }));

describe("projectNamespaceBase", () => {
  it("is deterministic, a multiple of 1000 and below 2^31", () => {
    const base = projectNamespaceBase("acme-web");
    expect(projectNamespaceBase("acme-web")).toBe(base);
    expect(base % 1000).toBe(0);
    expect(base).toBeGreaterThanOrEqual(100_000_000);
    expect(base + 300).toBeLessThan(2 ** 31);
  });

  it("differs between Worker names", () => {
    const names = ["acme-web", "brain-web", "domestique", "service-hub"];
    expect(new Set(names.map(projectNamespaceBase)).size).toBe(names.length);
  });

  it("never lands on the starter's shipped ids", () => {
    expect(
      STARTER_SHIPPED_NAMESPACE_IDS.has(String(projectNamespaceBase("x") + 1))
    ).toBe(false);
  });
});

describe("planNamespaceIds", () => {
  it("keeps the starter's own ids in the starter itself", () => {
    const plan = planNamespaceIds({
      workerName: STARTER_WORKER_NAME,
      env: "production",
      bindings: bindings("9001", "9002"),
      otherIds: ["7001", "8001"],
    });
    expect(plan.action).toBe("keep");
    expect(plan.ids.map((entry) => entry.id)).toEqual(["9001", "9002"]);
  });

  it("assigns the project's block once the Worker is renamed", () => {
    const base = projectNamespaceBase("acme-web");
    const plan = planNamespaceIds({
      workerName: "acme-web",
      env: "staging",
      bindings: bindings("8001", "8002", "8003"),
      otherIds: [],
    });
    expect(plan.action).toBe("assign");
    expect(plan.reasons.join()).toContain("starter's own");
    expect(plan.ids).toEqual([
      { name: "RL_0", id: String(base + 101) },
      { name: "RL_1", id: String(base + 102) },
      { name: "RL_2", id: String(base + 103) },
    ]);
  });

  it("also replaces the ids the starter shipped before (1001–3010)", () => {
    expect(
      planNamespaceIds({
        workerName: "acme-web",
        env: "develop",
        bindings: bindings("1001"),
        otherIds: [],
      }).action
    ).toBe("assign");
  });

  it("gives each environment its own range of the block", () => {
    const ids = (["develop", "staging", "production"] as const).map(
      (env) =>
        planNamespaceIds({
          workerName: "acme-web",
          env,
          bindings: bindings("3001"),
          otherIds: [],
        }).ids[0]?.id
    );
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps a project's own ids", () => {
    expect(
      planNamespaceIds({
        workerName: "acme-web",
        env: "develop",
        bindings: bindings("555001", "555002"),
        otherIds: ["555101"],
      }).action
    ).toBe("keep");
  });

  it("reassigns ids used twice, in the environment or across environments", () => {
    const within = planNamespaceIds({
      workerName: STARTER_WORKER_NAME,
      env: "develop",
      bindings: bindings("555001", "555001"),
      otherIds: [],
    });
    const across = planNamespaceIds({
      workerName: STARTER_WORKER_NAME,
      env: "develop",
      bindings: bindings("555001"),
      otherIds: ["555001"],
    });
    expect(within.action).toBe("assign");
    expect(across.action).toBe("assign");
    expect(across.reasons.join()).toContain("used twice");
  });

  it("reassigns missing or invalid ids", () => {
    const plan = planNamespaceIds({
      workerName: STARTER_WORKER_NAME,
      env: "develop",
      bindings: [{ name: "RL_A" }, { name: "RL_B", namespace_id: "0x1" }],
      otherIds: [],
    });
    expect(plan.action).toBe("assign");
  });

  it("uses an explicit base for every environment it is given for", () => {
    const plan = planNamespaceIds({
      workerName: STARTER_WORKER_NAME,
      env: "production",
      bindings: bindings("9001", "9002"),
      otherIds: [],
      base: 40_000,
      force: true,
    });
    expect(plan.ids.map((entry) => entry.id)).toEqual(["40201", "40202"]);
  });
});

describe("describeIds", () => {
  it("prints consecutive ids as a range", () => {
    expect(describeIds(["9002", "9001", "9003"])).toBe("9001–9003");
    expect(describeIds(["9001", "9005"])).toBe("9001, 9005");
    expect(describeIds([])).toBe("none");
  });
});

describe("bucketJurisdictionPlan", () => {
  it("writes the jurisdiction into an entry without one", () => {
    expect(bucketJurisdictionPlan({}, "eu")).toEqual({
      action: "write",
      jurisdiction: "eu",
    });
  });

  it("keeps the entry without --jurisdiction or when it matches", () => {
    expect(bucketJurisdictionPlan({}, undefined)).toEqual({ action: "keep" });
    expect(bucketJurisdictionPlan({ jurisdiction: "eu" }, "eu")).toEqual({
      action: "keep",
    });
    expect(bucketJurisdictionPlan({ jurisdiction: "eu" }, undefined)).toEqual({
      action: "keep",
    });
  });

  it("is what setup:cloudflare --jurisdiction eu --dry-run plans for the bucket binding", () => {
    // The dry run calls no Wrangler command and changes no file.
    const result = spawnSync(
      "bun",
      [
        "scripts/setup-cloudflare.ts",
        "--env",
        "production",
        "--jurisdiction",
        "eu",
        "--dry-run",
      ],
      { cwd: ROOT, encoding: "utf8" }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "wrangler r2 bucket create cloudflare-starter-files-production --jurisdiction eu"
    );
    expect(result.stdout).toContain(
      'wrangler.jsonc env.production.r2_buckets.0.jurisdiction = "eu"'
    );
    expect(result.stdout).toContain("= 9001–9012 kept");
  });

  it("refuses to move a bucket to another jurisdiction", () => {
    expect(
      bucketJurisdictionPlan({ jurisdiction: "eu" }, "fedramp").action
    ).toBe("conflict");
  });
});
