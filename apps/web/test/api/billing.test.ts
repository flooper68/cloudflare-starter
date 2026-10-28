import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test";
import {
  createMemoryBillingProvider,
  createMemoryJobQueue,
  SINGLE_WORKSPACE_ID,
  type SubscriptionChange,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { beforeAll, describe, expect, it } from "vitest";

import { POST as uploadRoute } from "@/pages/api/files/index";
import { POST as trpcRoute } from "@/pages/api/trpc/[...trpc]";
import { enforceSignUpPolicy } from "@/server/auth";
import { billingProviderFor } from "@/server/billing-provider";
import { handleBillingWebhook } from "@/server/billing-webhook";
import { runScheduled } from "@/server/cron";
import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import {
  APP_URL,
  callerFor,
  env,
  envWith,
  expectCrossWorkspaceDenied,
  inviteByMail,
  mailEnv,
  signUp,
  signUpRequest,
  type TestUser,
  testRequestContext,
} from "./helpers";

/** An admin's exception written straight to D1 (the admin procedures are tested below). */
async function override(
  workspaceId: string,
  key: string,
  value: { readonly enabled: boolean } | { readonly limit: number }
) {
  await env.DB.prepare(
    "INSERT INTO entitlement_override (workspace_id, key, kind, enabled, limit_value, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET enabled = excluded.enabled, limit_value = excluded.limit_value"
  )
    .bind(
      workspaceId,
      key,
      "enabled" in value ? "feature" : "limit",
      "enabled" in value ? Number(value.enabled) : null,
      "limit" in value ? value.limit : null,
      "API test",
      Date.now()
    )
    .run();
}

const workspaceOf = async (user: TestUser) =>
  (await callerFor(user).workspace.list()).activeWorkspaceId as string;

/** The caller of a platform admin (user.role = admin, as `bun run setup:admin` sets it). */
async function adminCaller(user: TestUser, runtimeEnv = env) {
  await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
    .bind(user.id)
    .run();
  return callerFor(user, runtimeEnv);
}

async function mcpCall(
  caller: ReturnType<typeof callerFor>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const requestContext = testRequestContext();
  const handler = createMcpHandler(() =>
    buildMcpServer(() => caller, {
      errors: buildPlatform(env).errors,
      tracer: buildPlatform(env).tracer.withContext(requestContext),
      requestContext,
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
  return JSON.parse(json).result as {
    isError?: boolean;
    structuredContent: Record<string, unknown>;
  };
}

function routeContext(request: Request, user: TestUser) {
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: {
      user: { id: user.id, email: user.email, name: user.name },
      requestContext: testRequestContext(),
    },
  } as unknown as APIContext;
}

describe("billing (BILLING=manual)", () => {
  let owner: TestUser;
  let colleague: TestUser;
  let workspaceId: string;
  beforeAll(async () => {
    owner = await signUp("Nicole Example", "nicole@example.test");
    colleague = await signUp("Grace Hopper", "grace@example.test");
    workspaceId = await workspaceOf(owner);
  });

  it("starts a new workspace's trial at sign-up and shows it to members", async () => {
    const summary = await callerFor(owner).workspace.billing.summary({});
    expect(summary).toMatchObject({
      mode: "manual",
      planId: "pro",
      status: "trialing",
      features: ["files.presigned_upload"],
    });
    expect(summary.usage.metrics.map((line) => line.metric)).toEqual([
      "storage_bytes",
      "files.uploads_per_month",
      "seats",
    ]);
    const mcp = await mcpCall(callerFor(owner), "get_billing_summary");
    expect(mcp.isError).toBeFalsy();
    expect(mcp.structuredContent).toMatchObject({ planId: "pro" });
  });

  it("refuses an upload over the storage_bytes limit on the binding path with Problem Details", async () => {
    await override(workspaceId, "storage_bytes", { limit: 5 });
    const form = new FormData();
    form.set(
      "file",
      new File(["Q4 roadmap"], "notes.txt", { type: "text/plain" })
    );
    const response = await uploadRoute(
      routeContext(
        new Request(`${APP_URL}/api/files`, {
          method: "POST",
          body: form,
          headers: { origin: APP_URL },
        }),
        owner
      )
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    expect(await response.json()).toMatchObject({
      title: "Limit Reached",
      status: 403,
      kind: "limit_reached",
      code: "LIMIT_REACHED",
      metric: "storage_bytes",
      limit: 5,
      current: 0,
      increment: 10,
      upgrade: { planIds: [], addonIds: ["extra_storage"] },
    });
  });

  it("refuses an upload over the storage_bytes limit on the presigned path", async () => {
    const withR2 = {
      ...env,
      R2_ACCOUNT_ID: "test-account",
      R2_ACCESS_KEY_ID: "test-key",
      R2_SECRET_ACCESS_KEY: "test-secret",
      R2_FILES_BUCKET_NAME: "test-bucket",
    };
    await expect(
      callerFor(owner, withR2).storage.createUpload({
        filename: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 6,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: {
        kind: "limit_reached",
        details: { metric: "storage_bytes", limit: 5, increment: 6 },
      },
    });
    await override(workspaceId, "storage_bytes", { limit: 1_000_000 });
    const created = await callerFor(owner, withR2).storage.createUpload({
      filename: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 6,
    });
    expect(created.uploadUrl).toContain("X-Amz-Signature");
  });

  it("answers limit_reached on the tRPC wire with data.domain, and through /mcp", async () => {
    await override(workspaceId, "files.presigned_upload", { enabled: false });
    const response = await trpcRoute(
      routeContext(
        new Request(`${APP_URL}/api/trpc/storage.createUpload`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trpc-source": "app",
          },
          body: JSON.stringify({
            filename: "video.mp4",
            mimeType: "video/mp4",
            sizeBytes: 100,
          }),
        }),
        owner
      )
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { data: Record<string, unknown> };
    };
    expect(body.error.data).toMatchObject({
      code: "FORBIDDEN",
      appCode: "FEATURE_NOT_INCLUDED",
      domain: {
        kind: "limit_reached",
        details: {
          feature: "files.presigned_upload",
          planId: "pro",
          upgrade: { planIds: [], addonIds: ["direct_uploads"] },
        },
      },
    });

    const tool = await mcpCall(callerFor(owner), "create_upload_url", {
      filename: "video.mp4",
      mimeType: "video/mp4",
      sizeBytes: 100,
    });
    expect(tool.isError).toBe(true);
    expect(tool.structuredContent).toEqual({
      error: {
        code: "FORBIDDEN",
        httpStatus: 403,
        message: "The pro plan does not include files.presigned_upload",
        appCode: "FEATURE_NOT_INCLUDED",
        domain: {
          kind: "limit_reached",
          details: {
            feature: "files.presigned_upload",
            planId: "pro",
            upgrade: { planIds: [], addonIds: ["direct_uploads"] },
          },
        },
      },
    });
  });

  it("refuses an invitation over the seats limit", async () => {
    const team = await callerFor(owner).workspace.create({ name: "Acme" });
    await override(team.id, "seats", { limit: 2 });
    await inviteByMail(owner, team.id, "first@acme.test");
    await expect(
      inviteByMail(owner, team.id, "second@acme.test")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: {
        kind: "limit_reached",
        details: { metric: "seats", limit: 2, current: 2, increment: 1 },
      },
    });
    const tool = await mcpCall(callerFor(owner, mailEnv), "invite_member", {
      workspaceId: team.id,
      email: "third@acme.test",
      role: "member",
    });
    expect(tool.structuredContent).toMatchObject({
      error: { code: "FORBIDDEN", domain: { kind: "limit_reached" } },
    });
  });

  it("keeps the admin procedures from everyone who is not a platform admin", async () => {
    const caller = callerFor(colleague);
    const input = { workspaceId };
    for (const call of [
      () => caller.admin.billing.get(input),
      () => caller.admin.billing.usage(input),
      () => caller.admin.billing.assignPlan({ ...input, planId: "free" }),
      () => caller.admin.billing.setAddons({ ...input, addons: [] }),
      () =>
        caller.admin.billing.setOverride({
          ...input,
          key: "seats",
          override: null,
          reason: "Not allowed",
        }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    await expect(
      callerFor(null).admin.billing.get(input)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const tool = await mcpCall(callerFor(colleague), "admin_assign_plan", {
      workspaceId,
      planId: "free",
    });
    expect(tool.structuredContent).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("lets a platform admin assign plans, add-ons and overrides, audited", async () => {
    const admin = await adminCaller(colleague);
    const target = await workspaceOf(colleague);
    await admin.admin.billing.assignPlan({
      workspaceId: target,
      planId: "free",
    });
    await admin.admin.billing.setAddons({
      workspaceId: target,
      addons: [{ addonId: "extra_seats", quantity: 1 }],
    });
    await admin.admin.billing.setOverride({
      workspaceId: target,
      key: "files.presigned_upload",
      override: { kind: "feature", enabled: true },
      reason: "Beta tester",
    });
    expect(
      await admin.admin.billing.get({ workspaceId: target })
    ).toMatchObject({
      planId: "free",
      status: "active",
      addons: [{ addonId: "extra_seats", quantity: 1 }],
      entitlements: {
        features: ["files.presigned_upload"],
        limits: { seats: 8 },
      },
    });
    const usage = await admin.admin.billing.usage({ workspaceId: target });
    expect(usage.metrics.find((line) => line.metric === "seats")).toMatchObject(
      { used: 1, limit: 8 }
    );
    const actions = await env.DB.prepare(
      "SELECT action FROM audit_events WHERE workspace_id = ? AND action LIKE 'billing.%' ORDER BY occurred_at, rowid"
    )
      .bind(target)
      .all<{ action: string }>();
    expect(actions.results.map((row) => row.action)).toEqual([
      "billing.trial_started",
      "billing.plan_assigned",
      "billing.addons_set",
      "billing.override_set",
    ]);
  });

  it("gives flags.client the workspace's plan, so plan rules target it", async () => {
    const admin = await adminCaller(owner);
    await admin.admin.flags.update({
      key: "upload-demo-presigned",
      enabled: true,
      fallthrough: false,
    });
    await admin.admin.flags.setRules({
      key: "upload-demo-presigned",
      rules: [{ kind: "plan", planId: "pro", value: true }],
    });
    // The owner's workspace is on the pro trial; the colleague's was put on free above.
    expect(await callerFor(owner).flags.client({ workspaceId })).toEqual({
      flags: { "upload-demo-presigned": true },
    });
    expect(await callerFor(colleague).flags.client({})).toEqual({
      flags: { "upload-demo-presigned": false },
    });
  });

  it("offers no checkout, portal or webhook outside provider mode", async () => {
    await expect(
      callerFor(owner).workspace.billing.checkoutUrl({ planId: "pro" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      callerFor(owner).workspace.billing.portalUrl({})
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const response = await handleBillingWebhook(
      new Request(`${APP_URL}/api/billing/webhook`, {
        method: "POST",
        body: "{}",
      }),
      env,
      testRequestContext()
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
  });

  it("billing.expire-trials: the daily cron enqueues the job, which lapses ended trials", async () => {
    const team = await callerFor(owner).workspace.create({ name: "Trial Co" });
    const jobQueue = createMemoryJobQueue();
    const platform = { ...buildPlatform(env), jobQueue };
    // Fifteen days on, the 14-day trial has ended.
    const scheduledTime = Date.now() + 15 * 24 * 60 * 60 * 1000;
    await runScheduled({ cron: "17 3 * * *", scheduledTime }, platform);
    const job = jobQueue.sent.find(
      (sent) => sent.envelope.type === "billing.expire-trials"
    );
    expect(job?.envelope.data).toEqual({
      asOf: new Date(scheduledTime).toISOString(),
    });

    // The consumer runs it from the real job catalog.
    const batch = createMessageBatch("cloudflare-starter-develop", [
      {
        id: "m-expire",
        timestamp: Date.now(),
        attempts: 1,
        body: job?.envelope,
      },
    ]);
    const ctx = createExecutionContext();
    await handleQueueBatch(batch, platform, queueDeps(env));
    expect((await getQueueResult(batch, ctx)).explicitAcks).toEqual([
      "m-expire",
    ]);
    const row = await env.DB.prepare(
      "SELECT plan_id, status FROM workspace_subscription WHERE workspace_id = ?"
    )
      .bind(team.id)
      .first();
    expect(row).toEqual({ plan_id: "free", status: "active" });
  });

  it("is reachable only by members (cross-workspace)", async () => {
    await expectCrossWorkspaceDenied("workspace.billing.summary", {});
    await expectCrossWorkspaceDenied("workspace.billing.checkoutUrl", {
      planId: "pro",
    });
    await expectCrossWorkspaceDenied("workspace.billing.portalUrl", {});
  });
});

describe("billing (BILLING=provider)", () => {
  const providerEnv = envWith({ WORKSPACE_MODE: "multi", BILLING: "provider" });

  it("fails clearly without a registered provider adapter", () => {
    expect(() => billingProviderFor(providerEnv)).toThrow(
      /BILLING=provider needs a billing provider adapter/
    );
  });

  it("checks out, applies the signed webhook and opens the portal", async () => {
    const owner = await signUp("Ada Lovelace", "ada@example.test", providerEnv);
    const provider = createMemoryBillingProvider({ secret: "whsec_test" });
    const caller = appRouter.createCaller(
      createAppContext(
        { id: owner.id, email: owner.email, name: owner.name },
        testRequestContext(),
        providerEnv,
        { billingProvider: provider }
      )
    );
    const workspaceId = (await caller.workspace.list())
      .activeWorkspaceId as string;

    expect(
      await caller.workspace.billing.checkoutUrl({ planId: "pro" })
    ).toEqual({
      url: `https://billing.example.test/checkout/${workspaceId}/pro`,
    });

    const change: SubscriptionChange = {
      workspaceId,
      planId: "pro",
      status: "active",
      periodStart: new Date("2026-10-28T00:00:00.000Z"),
      periodEnd: new Date("2099-11-28T00:00:00.000Z"),
      trialEndsAt: null,
      provider: "memory",
      customerId: "cus_ada",
      subscriptionId: "sub_ada",
      addons: [{ addonId: "extra_seats", quantity: 1 }],
      occurredAt: new Date(Date.now() + 60_000),
    };
    const webhook = (request: Request) =>
      handleBillingWebhook(
        request,
        providerEnv,
        testRequestContext(),
        provider
      );

    const forged = await webhook(
      provider.webhookRequest(change, { secret: "guess" })
    );
    expect(forged.status).toBe(400);
    expect(await forged.json()).toMatchObject({ kind: "invalid_input" });

    const ignored = await webhook(
      provider.webhookRequest(change, { type: "invoice.created" })
    );
    expect(await ignored.json()).toEqual({ received: true, applied: false });

    const applied = await webhook(provider.webhookRequest(change));
    expect(applied.status).toBe(200);
    expect(await applied.json()).toEqual({ received: true, applied: true });
    expect(await caller.workspace.billing.summary({})).toMatchObject({
      mode: "provider",
      planId: "pro",
      status: "active",
      addons: [{ addonId: "extra_seats", quantity: 1 }],
    });

    const unknown = await webhook(
      provider.webhookRequest({ ...change, workspaceId: "ws-missing" })
    );
    expect(unknown.status).toBe(404);

    expect(await caller.workspace.billing.portalUrl({})).toEqual({
      url: "https://billing.example.test/portal/cus_ada",
    });
    const tool = await mcpCall(caller, "get_checkout_url", { planId: "free" });
    expect(tool.structuredContent).toEqual({
      url: `https://billing.example.test/checkout/${workspaceId}/free`,
    });
  });
});

describe("billing in single mode", () => {
  it("refuses an open sign-up into a full workspace with LIMIT_REACHED and a clear message", async () => {
    const singleEnv = envWith({
      WORKSPACE_MODE: "single",
      SIGN_UP: "open",
      BOOTSTRAP_ADMIN_EMAIL: "founder@acme.test",
    });
    // The first sign-up creates the app's workspace.
    expect(
      (await signUpRequest("Frances Founder", "founder@acme.test", singleEnv))
        .status
    ).toBe(200);
    await override(SINGLE_WORKSPACE_ID, "seats", { limit: 1 });

    const refused = await signUpRequest(
      "Stan Stranger",
      "stan@example.test",
      singleEnv
    );
    // With email verification on (as single mode with a bootstrap admin requires), Better
    // Auth answers a refused email sign-up like a created one (no account enumeration);
    // the account is not created. Google sign-ups and the hook itself carry the code.
    expect(refused.status).toBe(200);
    expect(((await refused.json()) as { token: unknown }).token).toBeNull();
    await expect(
      enforceSignUpPolicy(singleEnv, { email: "stan@example.test" })
    ).rejects.toMatchObject({
      body: {
        code: "LIMIT_REACHED",
        message:
          "This workspace has no free seats. Ask its owner to invite you or to add seats.",
      },
    });
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = ?")
      .bind("stan@example.test")
      .first();
    expect(user).toBeNull();
  });
});

describe("billing (BILLING=off)", () => {
  it("gives a new workspace everything without a subscription", async () => {
    const offEnv = envWith({ WORKSPACE_MODE: "multi", BILLING: "off" });
    const user = await signUp("Alan Turing", "alan@example.test", offEnv);
    expect(
      await callerFor(user, offEnv).workspace.billing.summary({})
    ).toMatchObject({ mode: "off", planId: "unlimited", status: null });
    const rows = await env.DB.prepare(
      "SELECT count(*) AS n FROM workspace_subscription WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?)"
    )
      .bind(user.id)
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });
});
