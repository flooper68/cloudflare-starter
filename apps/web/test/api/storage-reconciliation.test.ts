import { env as workerEnv } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppEnv } from "@/server/env";
import { MCP_TOOLS } from "@/server/mcp/tools";
import { browserCallerFor, callerFor, signUp, type TestUser } from "./helpers";

const env = workerEnv as AppEnv;
let admin: TestUser;
let member: TestUser;
beforeAll(async () => {
  admin = await signUp("Storage admin", "storage-admin@example.test");
  member = await signUp("Storage member", "storage-member@example.test");
  await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
    .bind(admin.id)
    .run();
});
describe("admin storage reconciliation", () => {
  it("refuses anonymous and regular users", async () => {
    await expect(callerFor(null).admin.storage.status()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      callerFor(member).admin.storage.reconcile()
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("reports configuration and queues a report while off", async () => {
    const caller = callerFor(admin);
    expect(await caller.admin.storage.status()).toEqual({
      mode: "off",
      graceHours: 24,
    });
    expect(await caller.admin.storage.reconcile()).toMatchObject({
      mode: "report",
      runId: expect.any(String),
    });
  });
  it("requires explicit deletion setting and recent signin", async () => {
    const { caller } = browserCallerFor(admin);
    await expect(caller.admin.storage.deleteOrphans()).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { code: "STORAGE_DELETION_DISABLED" },
    });
  });
  it("queues deletion only for a fresh admin when enabled", async () => {
    const runtimeEnv = { ...env, STORAGE_RECONCILE: "delete" };
    const stale = browserCallerFor(admin, {
      runtimeEnv,
      signedInMinutesAgo: 30,
    });
    await expect(
      stale.caller.admin.storage.deleteOrphans()
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { code: "REAUTH_REQUIRED" },
    });
    const fresh = browserCallerFor(admin, { runtimeEnv });
    expect(await fresh.caller.admin.storage.deleteOrphans()).toMatchObject({
      mode: "delete",
    });
  });
  it("exposes report and status through MCP; deletion is marked destructive", async () => {
    const caller = callerFor(admin);
    const status = MCP_TOOLS.find((x) => x.name === "admin_storage_status");
    expect(await status?.run(caller, {})).toEqual({
      mode: "off",
      graceHours: 24,
    });
    expect(
      await MCP_TOOLS.find((x) => x.name === "admin_reconcile_storage")?.run(
        caller,
        {}
      )
    ).toMatchObject({ mode: "report" });
    expect(
      MCP_TOOLS.find((x) => x.name === "admin_delete_storage_orphans")
        ?.destructive
    ).toBe(true);
  });
});
