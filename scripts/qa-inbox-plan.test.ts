import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT } from "./lib";
import {
  catchAllPlan,
  databaseIdFrom,
  databaseIdFromCreate,
  isSubdomainOf,
  QA_INBOX_WORKER,
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

  it("points an off or dropping catch-all at the inbox", () => {
    expect(catchAllPlan(null, QA_INBOX_WORKER, false).action).toBe("set");
    expect(
      catchAllPlan({ enabled: false }, QA_INBOX_WORKER, false).action
    ).toBe("set");
    expect(
      catchAllPlan(
        { enabled: true, actions: [{ type: "drop" }] },
        QA_INBOX_WORKER,
        false
      ).action
    ).toBe("set");
  });

  it("keeps a catch-all that already goes to the inbox", () => {
    expect(
      catchAllPlan(
        {
          enabled: true,
          actions: [{ type: "worker", value: [QA_INBOX_WORKER] }],
        },
        QA_INBOX_WORKER,
        false
      ).action
    ).toBe("keep");
  });

  it("never replaces a forwarding catch-all without --replace-catch-all", () => {
    const forwarding = {
      enabled: true,
      actions: [{ type: "forward", value: ["owner@example.com"] }],
    };
    const plan = catchAllPlan(forwarding, QA_INBOX_WORKER, false);
    expect(plan.action).toBe("conflict");
    expect(plan.reason).toContain("owner@example.com");
    expect(catchAllPlan(forwarding, QA_INBOX_WORKER, true).action).toBe("set");
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
      "wrangler email routing rules update flooper.me catch-all --action-type worker --action-value cloudflare-starter-qa-inbox"
    );
    expect(result.stdout).toContain("Dry run: nothing was called or changed.");
    expect(readFileSync(config, "utf8")).toBe(before);
  });
});
