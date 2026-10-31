import { describe, expect, it } from "vitest";
import { DATA_CATALOG } from "../../packages/features/src";
import { filesUnder, read } from "./repo";

const sql = filesUnder("packages/features/migrations", /\.sql$/)
  .map(read)
  .join("\n");
describe("privacy data catalog", () => {
  it("covers every persistent table with export and erasure treatment", () => {
    const tables = [...sql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(
      (x) => x[1]
    );
    expect(new Set(DATA_CATALOG.map((x) => x.table)).size).toBe(
      DATA_CATALOG.length
    );
    for (const table of tables) {
      const entity = DATA_CATALOG.find((x) => x.table === table);
      expect(entity, table).toBeDefined();
      expect(entity?.reason.length).toBeGreaterThan(20);
      expect(entity?.erase).toBeTruthy();
    }
  });
  it("uses only actual projected columns, never authentication secrets", () => {
    for (const entity of DATA_CATALOG) {
      const table = sql
        .split("CREATE TABLE `" + entity.table + "` (")[1]
        ?.split("\n);")[0];
      if (entity.optional && !table) continue;
      expect(table, entity.table).toBeTruthy();
      for (const column of entity.columns) {
        expect(column).not.toMatch(
          /password|token|secret|backup|private_key|public_key|credential_id|counter/
        );
        expect(table, `${entity.table}.${column}`).toContain(
          "`" + column + "`"
        );
      }
    }
  });
  it("keeps signing material and second-factor secrets out of every export", () => {
    for (const table of [
      "verification",
      "jwks",
      "oauth_access_token",
      "oauth_refresh_token",
      "two_factor",
    ]) {
      expect(DATA_CATALOG.find((x) => x.table === table)?.columns).toEqual([]);
    }
  });
  it("keeps operational billing erasure explicit rather than claiming fiscal retention", () => {
    for (const name of [
      "workspace_subscription",
      "workspace_addon",
      "entitlement_override",
      "usage_counter",
    ]) {
      const e = DATA_CATALOG.find((x) => x.table === name);
      expect(e?.erase).toBe("workspace-cascade");
      expect(e?.reason).toContain("not invoices");
    }
  });
});
