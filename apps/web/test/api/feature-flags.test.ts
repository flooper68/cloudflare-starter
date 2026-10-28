import { flagBucket } from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, it } from "vitest";

import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import {
  APP_URL,
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

/**
 * TODO(admin-portal): the platform role has no column yet; until the admin portal lands,
 * an admin is a signed-up user whose context carries role "admin".
 */
function adminCallerFor(user: TestUser) {
  return appRouter.createCaller(
    createAppContext(
      { id: user.id, email: user.email, name: user.name, role: "admin" },
      testRequestContext(),
      env
    )
  );
}

async function mcp(
  caller: ReturnType<typeof callerFor>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const handler = createMcpHandler(() =>
    buildMcpServer(() => caller, {
      errors: buildPlatform(env).errors,
      requestContext: testRequestContext(),
      tracer: buildPlatform(env).tracer,
    })
  );
  const response = await handler.fetch(
    new Request(`${APP_URL}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
  );
  const text = await response.text();
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return JSON.parse(json).result;
}

/** Whether a workspace is inside a 50 % rollout of the example flag. */
const inHalf = (workspaceId: string) =>
  flagBucket("upload-demo-presigned", workspaceId) < 5000;

describe("feature flags (FEATURE_FLAGS=d1, real D1)", () => {
  // Grace administers the flags; her workspaces are the rollout's subjects.
  let grace: TestUser;
  let member: TestUser;
  const workspaces: string[] = [];
  beforeAll(async () => {
    grace = await signUp("Grace Hopper", "grace@example.test");
    member = await signUp("Mary Jackson", "mary@example.test");
    // Shared workspaces (random ids) until there is one on each side of the 50 % split;
    // twenty tries leave a one-in-a-million chance of a one-sided set.
    for (let n = 1; n <= 20; n += 1) {
      const created = await callerFor(grace).workspace.create({
        name: `Analytical Engine ${n}`,
      });
      workspaces.push(created.id);
      if (workspaces.some(inHalf) && workspaces.some((id) => !inHalf(id)))
        break;
    }
  });

  it("flags.client returns the catalog defaults before anything is configured, and needs sign-in", async () => {
    expect(
      await callerFor(grace).flags.client({ workspaceId: workspaces[0] })
    ).toEqual({ flags: { "upload-demo-presigned": true } });
    // The user's current workspace when none is named.
    expect(await callerFor(member).flags.client({})).toEqual({
      flags: { "upload-demo-presigned": true },
    });
    await expect(callerFor(null).flags.client({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("flags.client refuses a workspace the caller is not a member of", async () => {
    await expectCrossWorkspaceDenied("flags.client", {});
  });

  it("admin procedures answer NOT_FOUND to members and anonymous callers", async () => {
    for (const caller of [callerFor(member), callerFor(null)]) {
      await expect(caller.admin.flags.list()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        caller.admin.flags.update({
          key: "upload-demo-presigned",
          enabled: false,
          fallthrough: null,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller.admin.flags.setRules({ key: "upload-demo-presigned", rules: [] })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("an admin rolls a flag out to 50 % of workspaces; flags.client follows per workspace and audits each write", async () => {
    const admin = adminCallerFor(grace);
    expect(
      await admin.admin.flags.update({
        key: "upload-demo-presigned",
        enabled: true,
        fallthrough: false,
      })
    ).toMatchObject({ enabled: true, fallthrough: false, updatedBy: grace.id });
    await admin.admin.flags.setRules({
      key: "upload-demo-presigned",
      rules: [{ kind: "percentage", percentageBp: 5000, value: true }],
    });

    const inside = workspaces.find(inHalf) as string;
    const outside = workspaces.find((id) => !inHalf(id)) as string;
    expect(
      await callerFor(grace).flags.client({ workspaceId: inside })
    ).toEqual({ flags: { "upload-demo-presigned": true } });
    expect(
      await callerFor(grace).flags.client({ workspaceId: outside })
    ).toEqual({ flags: { "upload-demo-presigned": false } });

    const { flags } = await admin.admin.flags.list();
    expect(flags[0]?.stored).toMatchObject({
      enabled: true,
      fallthrough: false,
      rules: [{ kind: "percentage", percentageBp: 5000, value: true }],
      updatedBy: grace.id,
    });

    const { results } = await env.DB.prepare(
      "SELECT action, actor_kind, actor_user_id, workspace_id, trace_id FROM audit_events WHERE target_type = 'feature_flag' ORDER BY occurred_at, rowid"
    ).all();
    expect(results).toEqual([
      expect.objectContaining({
        action: "feature_flag.updated",
        actor_kind: "admin",
        actor_user_id: grace.id,
        workspace_id: null,
      }),
      expect.objectContaining({ action: "feature_flag.rules_changed" }),
    ]);
  });

  it("an admin's invalid changes are refused: unknown flag, wrong value type, bad rule", async () => {
    const admin = adminCallerFor(grace);
    await expect(
      admin.admin.flags.update({
        key: "dark-launch",
        enabled: true,
        fallthrough: null,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      cause: { code: "UNKNOWN_FLAG" },
    });
    await expect(
      admin.admin.flags.setRules({
        key: "upload-demo-presigned",
        rules: [{ kind: "plan", planId: "business", value: "yes" }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      admin.admin.flags.setRules({
        key: "upload-demo-presigned",
        rules: [{ kind: "percentage", percentageBp: 20_000, value: true }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a flag whose stored JSON does not parse is listed as invalid and repaired by a write, never a 500", async () => {
    await env.DB.prepare(
      "UPDATE feature_flags SET fallthrough_json = 'on' WHERE key = 'upload-demo-presigned'"
    ).run();
    const admin = adminCallerFor(grace);
    // list() always reads D1, so it sees the hand-made change at once.
    const { flags } = await admin.admin.flags.list();
    expect(flags[0]?.stored).toMatchObject({
      invalid: true,
      error: expect.stringContaining("JSON"),
    });
    expect(
      await admin.admin.flags.update({
        key: "upload-demo-presigned",
        enabled: true,
        fallthrough: false,
      })
    ).toMatchObject({ enabled: true, fallthrough: false });
  });

  it("the same calls work through /mcp, with the same admin check", async () => {
    const admin = adminCallerFor(grace);
    const inside = workspaces.find(inHalf) as string;
    const updated = await mcp(admin, "update_feature_flag", {
      key: "upload-demo-presigned",
      enabled: false,
      fallthrough: null,
    });
    expect(updated.structuredContent).toMatchObject({
      key: "upload-demo-presigned",
      enabled: false,
    });
    const rules = await mcp(admin, "set_feature_flag_rules", {
      key: "upload-demo-presigned",
      rules: [{ kind: "workspace", workspaceId: inside, value: true }],
    });
    expect(rules.structuredContent.rules).toEqual([
      { kind: "workspace", workspaceId: inside, value: true },
    ]);
    const listed = await mcp(admin, "list_feature_flags");
    expect(listed.structuredContent.flags[0].stored.enabled).toBe(false);
    // Disabled: everyone gets the catalog default again.
    expect(
      (await mcp(callerFor(grace), "get_client_flags", { workspaceId: inside }))
        .structuredContent
    ).toEqual({ flags: { "upload-demo-presigned": true } });

    const refused = await mcp(callerFor(member), "list_feature_flags");
    expect(refused.isError).toBe(true);
    expect(refused.structuredContent.error.code).toBe("NOT_FOUND");
  });
});
