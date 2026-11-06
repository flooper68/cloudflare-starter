import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";

import { literal, lookupSql, roleChangeSql, userIdSubquery } from "./admin-sql";
import { ROOT } from "./lib";

describe("admin SQL", () => {
  it("escapes quotes in literals", () => {
    expect(literal("o'brien@example.com")).toBe("'o''brien@example.com'");
  });

  it("looks the account up by lower-cased address", () => {
    expect(lookupSql("a@example.com")).toBe(
      "SELECT id, role, banned FROM user WHERE lower(email) = 'a@example.com'"
    );
  });

  it("promotes with a role_changed and an unbanned audit row", () => {
    const sql = roleChangeSql({
      userId: { literal: "u1" },
      role: "admin",
      previousRole: "user",
      unban: true,
      now: 42,
      traceId: "t1",
      auditIds: ["a1", "a2"],
    });
    expect(sql).toContain(
      "UPDATE user SET role = 'admin', banned = 0, ban_reason = NULL, ban_expires = NULL, updated_at = 42 WHERE id = 'u1';"
    );
    expect(sql).toContain(
      `VALUES ('a1', 42, 'user.role_changed', 'success', NULL, 'system', NULL, 'user', 'u1', NULL, 't1', 'script', NULL, '{"previousRole":"user","role":"admin"}');`
    );
    expect(sql).toContain("VALUES ('a2', 42, 'user.unbanned'");
  });

  it("only lifts a suspension when the role already matches", () => {
    const sql = roleChangeSql({
      userId: { literal: "u1" },
      role: "admin",
      previousRole: "admin",
      unban: true,
      now: 1,
      traceId: "t",
      auditIds: ["a1"],
    });
    expect(sql).not.toContain("user.role_changed");
    expect(sql).toContain("VALUES ('a1', 1, 'user.unbanned'");
  });

  it("targets the account by subquery in the dry run", () => {
    const sql = roleChangeSql({
      userId: { sql: userIdSubquery("a@example.com") },
      role: "user",
      previousRole: "admin",
      unban: false,
      now: 1,
      traceId: "t",
      auditIds: ["a1"],
    });
    expect(sql).toContain(
      "WHERE id = (SELECT id FROM user WHERE lower(email) = 'a@example.com');"
    );
    expect(sql).not.toContain("banned = 0");
  });
});

describe("setup:admin --dry-run", () => {
  it("is offline: prints the SQL and never runs Wrangler, even with --remote", () => {
    // A bunx that records being called shadows the real one.
    const bin = mkdtempSync(join(tmpdir(), "setup-admin-"));
    const marker = join(bin, "called");
    writeFileSync(join(bin, "bunx"), `#!/bin/sh\ntouch "${marker}"\nexit 1\n`);
    chmodSync(join(bin, "bunx"), 0o755);
    const result = spawnSync(
      "bun",
      [
        "scripts/setup-admin.ts",
        "--email",
        "Owner@Example.com",
        "--remote",
        "--env",
        "production",
        "--dry-run",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
      }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(marker)).toBe(false);
    expect(result.stdout).toContain(
      "d1 execute DB --remote --env production --json --command SELECT id, role, banned FROM user WHERE lower(email) = 'owner@example.com'"
    );
    expect(result.stdout).toContain("UPDATE user SET role = 'admin'");
    expect(result.stdout).toContain("Dry run: nothing was changed.");
  });
});
