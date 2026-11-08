import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT } from "./lib";
import {
  databaseIdFrom,
  databaseIdFromCreate,
  describeRouting,
  isSubdomainOf,
  QA_INBOX_WORKER,
  rulePlan,
  rulesGainingSubaddresses,
  subdomainRoutingReady,
  zoneOf,
} from "./qa-inbox-plan";

const ID = "4f940521-26cd-4e54-a7fd-1d3470083c59";

describe("setup:qa-inbox planning", () => {
  it("finds the zone of the mail subdomain and refuses the zone itself", () => {
    expect(zoneOf("qa.flooper.me")).toBe("flooper.me");
    expect(isSubdomainOf("qa.flooper.me", "flooper.me")).toBe(true);
    expect(isSubdomainOf("flooper.me", "flooper.me")).toBe(false);
    expect(isSubdomainOf("qa.notflooper.me", "flooper.me")).toBe(false);
  });

  it("reads the database id from d1 list and d1 create", () => {
    expect(
      databaseIdFrom(
        JSON.stringify([
          { name: "other", uuid: "x" },
          { name: "cloudflare-starter-qa-inbox", uuid: ID },
        ]),
        "cloudflare-starter-qa-inbox"
      )
    ).toBe(ID);
    expect(databaseIdFrom("[]", "cloudflare-starter-qa-inbox")).toBeNull();
    expect(databaseIdFrom("not json", "x")).toBeNull();
    expect(
      databaseIdFromCreate(`{\n  "binding": "DB",\n  "database_id": "${ID}"\n}`)
    ).toBe(ID);
  });

  const ours = {
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: "qa@qa.flooper.me" }],
    actions: [{ type: "worker", value: [QA_INBOX_WORKER] }],
  };
  const catchAll = {
    enabled: true,
    matchers: [{ type: "all" }],
    actions: [{ type: "forward", value: ["owner@example.com"] }],
  };
  const support = {
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: "support@flooper.me" }],
    actions: [{ type: "forward", value: ["owner@example.com"] }],
  };

  it("creates the qa@ rule when nothing routes it, whatever the catch-all does", () => {
    expect(rulePlan([], "qa@qa.flooper.me", QA_INBOX_WORKER).action).toBe(
      "create"
    );
    expect(
      rulePlan([catchAll, support], "qa@qa.flooper.me", QA_INBOX_WORKER).action
    ).toBe("create");
  });

  it("keeps the qa@ rule that already goes to the inbox", () => {
    expect(
      rulePlan([catchAll, ours], "QA@qa.flooper.me", QA_INBOX_WORKER).action
    ).toBe("keep");
  });

  it("never overwrites a qa@ rule that goes elsewhere or is disabled", () => {
    const elsewhere = {
      ...ours,
      actions: [{ type: "forward", value: ["someone@example.com"] }],
    };
    const plan = rulePlan([elsewhere], "qa@qa.flooper.me", QA_INBOX_WORKER);
    expect(plan.action).toBe("conflict");
    expect(plan.reason).toContain("someone@example.com");
    expect(
      rulePlan(
        [{ ...ours, enabled: false }],
        "qa@qa.flooper.me",
        QA_INBOX_WORKER
      ).action
    ).toBe("conflict");
  });

  it("names the existing rules that subaddressing would widen", () => {
    expect(
      rulesGainingSubaddresses([catchAll, ours, support], "qa@qa.flooper.me")
    ).toEqual(["support@flooper.me"]);
  });

  it("describes the zone's routing for the preflight", () => {
    const lines = describeRouting({
      zone: "flooper.me",
      settings: { enabled: true, status: "ready", support_subaddress: false },
      catchAll,
      rules: [catchAll, support],
      subdomain: "qa.flooper.me",
      subdomainReady: false,
    });
    expect(lines).toEqual([
      "Email Routing on flooper.me: enabled (status ready)",
      "Subaddressing (support_subaddress): off",
      "Catch-all: enabled, forward owner@example.com",
      "qa.flooper.me MX/SPF records: missing",
      "Rules (the catch-all aside):",
      "  - to = support@flooper.me → forward owner@example.com",
    ]);
  });

  it("knows when the subdomain's records are in place", () => {
    expect(
      subdomainRoutingReady({
        result: { record: [{ type: "MX" }, { type: "TXT" }], errors: [] },
      })
    ).toBe(true);
    expect(
      subdomainRoutingReady({
        result: { record: [{ type: "MX" }], errors: [{ code: "missing" }] },
      })
    ).toBe(false);
    expect(subdomainRoutingReady({})).toBe(false);
  });

  it("the dry run calls nothing, changes no file and prints the plan", () => {
    const config = join(ROOT, "apps/qa-inbox/wrangler.jsonc");
    const before = readFileSync(config, "utf8");
    const result = spawnSync(
      "bun",
      ["scripts/setup-qa-inbox.ts", "--dry-run"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, CLOUDFLARE_API_TOKEN: "" },
      }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "wrangler d1 create cloudflare-starter-qa-inbox"
    );
    expect(result.stdout).toContain("wrangler deploy");
    expect(result.stdout).toContain(
      'POST https://api.cloudflare.com/client/v4/zones/<zone id>/email/routing/dns {"name":"qa.flooper.me"}'
    );
    expect(result.stdout).toContain(
      "wrangler email routing rules create flooper.me --name QA inbox --match-type literal --match-field to --match-value qa@qa.flooper.me --action-type worker --action-value cloudflare-starter-qa-inbox"
    );
    expect(result.stdout).toContain(
      'PUT https://api.cloudflare.com/client/v4/zones/<zone id>/email/routing {"support_subaddress":true}'
    );
    expect(result.stdout).not.toMatch(/catch-all --action|PUT .*catch_all/);
    expect(result.stdout).toContain("Dry run: nothing was called or changed.");
    expect(readFileSync(config, "utf8")).toBe(before);
  });
});
