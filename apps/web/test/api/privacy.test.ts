import { env as workerEnv } from "cloudflare:workers";
import {
  buildDataExport,
  createFflateZip,
  DATA_CATALOG,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { MCP_TOOLS } from "@/server/mcp/tools";
import { buildPlatform } from "@/server/platform";
import {
  browserCallerFor,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const env = workerEnv as AppEnv;
let person: TestUser;
let other: TestUser;
beforeAll(async () => {
  person = await signUp("Privacy API", "privacy-api@example.test");
  other = await signUp("Privacy other", "privacy-other@example.test");
});
describe("privacy API", () => {
  it("requires signin and refuses another workspace", async () => {
    await expect(
      callerFor(null).privacy.requestExport({})
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const ws = await callerFor(other).workspace.create({
      name: "Other company",
    });
    await expect(
      callerFor(person).privacy.requestExport({ workspaceId: ws.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("queues, lists and delivers only the requesting user's completed export", async () => {
    const caller = callerFor(person);
    const request = await caller.privacy.requestExport({});
    expect(await caller.privacy.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: request.id, status: "queued" }),
      ])
    );
    await expect(
      callerFor(other).privacy.download({ requestId: request.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const platform = buildPlatform(env);
    await buildDataExport(
      {
        db: getDb(env),
        bucket: env.FILES,
        catalog: DATA_CATALOG,
        zip: createFflateZip(),
        clock: systemClock,
        ids: randomIds,
        requestContext: testRequestContext(),
        errors: platform.errors,
        app: { secret: "privacy-test-secret-000000000000000000" },
        notify: async () => ({
          status: "enqueued",
          eventId: "test",
          recipients: 1,
        }),
      },
      { requestId: request.id, attempts: 1 }
    );
    expect(
      (await caller.privacy.download({ requestId: request.id })).href
    ).toContain("signature=");
    const tool = MCP_TOOLS.find((x) => x.name === "list_data_exports");
    expect(await tool?.run(caller, {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: request.id, status: "ready" }),
      ])
    );
  });
  it("guards administration and delivers requested exports to the subject", async () => {
    await expect(callerFor(person).admin.privacy.list()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await env.DB.prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(other.id)
      .run();
    const admin = browserCallerFor(other).caller;
    expect((await admin.admin.privacy.list()).exports.length).toBeGreaterThan(
      0
    );
    const target = await signUp(
      "Export subject",
      "export-subject@example.test"
    );
    expect(
      await admin.admin.privacy.requestExport({ userId: target.id })
    ).toMatchObject({ status: "queued" });
    await expect(
      callerFor(person).admin.privacy.eraseUser({ userId: target.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerFor(other).admin.privacy.eraseUser({ userId: target.id })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      callerFor(other).admin.users.remove({ userId: target.id })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(MCP_TOOLS.some((x) => x.name === "admin_remove_user")).toBe(false);
    expect(
      MCP_TOOLS.some((x) => x.procedures.includes("admin.privacy.eraseUser"))
    ).toBe(false);
  });
});
