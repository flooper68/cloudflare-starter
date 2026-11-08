/**
 * The container workflow demo end to end in workerd: tRPC and /mcp start a run, the real
 * ContainerRunWorkflow runs in Miniflare's Workflows engine (introspected with the
 * Workflows test utilities) against the fake pi computer (CONTAINER_DEMO_RUNNER=fake;
 * the container adapter has its own contract test), results land in R2, the starter is
 * notified, and the limits, auth and workspace isolation hold.
 */

import { introspectWorkflow } from "cloudflare:test";
import { failRunSteps, newRunSteps } from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

import { GET } from "@/pages/api/container-runs/[id]/result";
import type { AppEnv } from "@/server/env";
import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";

import {
  APP_URL,
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  inviteByMail,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const runRef = "00000000-0000-4000-8000-000000000001";

/** The Worker's env with other container demo settings (one object each, like envWith). */
const envs = new Map<string, AppEnv>();
function containerEnv(vars: Record<string, string>): AppEnv {
  const key = JSON.stringify(vars);
  let value = envs.get(key);
  if (!value) {
    value = { ...env, ...vars };
    envs.set(key, value);
  }
  return value;
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

function download(user: TestUser | null, runId: string, query = "") {
  const request = new Request(
    `${APP_URL}/api/container-runs/${runId}/result${query}`
  );
  return GET({
    request,
    url: new URL(request.url),
    params: { id: runId },
    locals: {
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      requestContext: testRequestContext(),
    },
  } as unknown as APIContext);
}

async function workspaceOf(user: TestUser): Promise<string> {
  return (await callerFor(user).workspace.list()).activeWorkspaceId as string;
}

/** Five runs of the last hour for `user`, written straight to D1. */
async function seedRecentRuns(user: TestUser, workspaceId: string) {
  for (let index = 0; index < 5; index += 1) {
    await env.DB.prepare(
      "INSERT INTO container_runs (id, workspace_id, created_by, digits, status, steps, created_at, expires_at) VALUES (?, ?, ?, 1000, 'failed', ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        workspaceId,
        user.id,
        JSON.stringify(failRunSteps(newRunSteps(new Date()), new Date())),
        Date.now() - 60_000,
        Date.now() + 86_400_000
      )
      .run();
  }
}

describe("container runs", () => {
  it("runs the whole workflow: queued → starting → computing → storing → notifying → done, with the result in R2", async () => {
    await using introspector = await introspectWorkflow(
      env.CONTAINER_RUN_WORKFLOW as Workflow
    );
    const owner = await signUp("Ada Container", "ada@containers.test");
    const member = await signUp("Grace Container", "grace@containers.test");
    const team = await callerFor(owner).workspace.create({ name: "Pi lab" });
    const workspaceId = team.id;
    const token = await inviteByMail(owner, workspaceId, member.email);
    await callerFor(member).workspace.invitations.accept({ token });

    const started = await callerFor(member).containerRuns.start({
      workspaceId,
      digits: 1000,
    });
    expect(started).toEqual({ runId: expect.any(String), status: "queued" });

    const [instance] = await introspector.get();
    await instance?.waitForStatus("complete");
    expect(await instance?.getOutput()).toEqual({
      runId: started.runId,
      outcome: "succeeded",
    });

    const run = await callerFor(owner).containerRuns.get({
      workspaceId,
      runId: started.runId,
    });
    expect(run).toMatchObject({
      status: "succeeded",
      digits: 1000,
      errorCode: null,
      startedBy: { id: member.id, name: "Grace Container" },
      result: {
        preview: expect.stringMatching(/^3\.14159265358979/),
        bytes: 1003,
        downloadHref: `/api/container-runs/${started.runId}/result?workspaceId=${workspaceId}`,
      },
    });
    expect(run.steps.map((step) => [step.name, step.status])).toEqual([
      ["queued", "done"],
      ["starting", "done"],
      ["computing", "done"],
      ["storing", "done"],
      ["notifying", "done"],
      ["done", "done"],
    ]);
    for (const step of run.steps) {
      expect(step.startedAt).not.toBeNull();
      expect(step.finishedAt).not.toBeNull();
    }
    expect(run.durationMs).toBeGreaterThan(0);
    expect(run.result?.preview).toHaveLength(102);

    // The download: members of the workspace only.
    const response = await download(
      member,
      started.runId,
      `?workspaceId=${workspaceId}`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="pi-1000-digits.txt"'
    );
    expect((await response.text()).trim().slice(-10)).toBe("2164201989");
    const stranger = await signUp("Eve Container", "eve@containers.test");
    expect(
      (await download(stranger, started.runId, `?workspaceId=${workspaceId}`))
        .status
    ).toBe(404);
    expect((await download(null, started.runId)).status).toBe(404);
    expect((await download(member, "not-a-uuid")).status).toBe(404);

    // The starter is notified in the app; the start and the finish are audited.
    await vi.waitFor(
      async () => {
        const { results } = await env.DB.prepare(
          "SELECT type FROM notifications WHERE user_id = ?"
        )
          .bind(member.id)
          .all<{ type: string }>();
        expect(results.map((row) => row.type)).toContain(
          "container-runs.finished"
        );
      },
      { timeout: 20_000, interval: 250 }
    );
    const { results: audit } = await env.DB.prepare(
      "SELECT action, actor_kind, outcome FROM audit_events WHERE target_id = ? ORDER BY occurred_at, rowid"
    )
      .bind(started.runId)
      .all();
    expect(audit).toEqual([
      {
        action: "container_run.started",
        actor_kind: "user",
        outcome: "success",
      },
      {
        action: "container_run.finished",
        actor_kind: "system",
        outcome: "success",
      },
    ]);
  }, 60_000);

  it("fails the run when the container does not start, notifies, and a retry runs again", async () => {
    await using introspector = await introspectWorkflow(
      env.CONTAINER_RUN_WORKFLOW as Workflow
    );
    await introspector.modifyAll(async (m) => {
      await m.disableRetryDelays();
      await m.mockStepError(
        { name: "start container" },
        new Error("container did not start")
      );
    });
    const user = await signUp("Alan Container", "alan@containers.test");
    const workspaceId = await workspaceOf(user);
    const caller = callerFor(user);

    const failed = await caller.containerRuns.start({
      workspaceId,
      digits: 10_000,
    });
    const [instance] = await introspector.get();
    await instance?.waitForStatus("errored");

    const run = await caller.containerRuns.get({
      workspaceId,
      runId: failed.runId,
    });
    expect(run).toMatchObject({
      status: "failed",
      errorCode: "container_unavailable",
      result: null,
    });
    expect(run.steps.map((step) => step.status)).toEqual([
      "done",
      "failed",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
    ]);

    await expect(
      caller.containerRuns.start({ workspaceId, retryOf: run.id })
    ).resolves.toMatchObject({ status: "queued" });
    const listed = await caller.containerRuns.list({ workspaceId });
    expect(listed.items[0]).toMatchObject({ retryOf: run.id, digits: 10_000 });
    // A run that did not fail cannot be retried.
    await expect(
      caller.containerRuns.start({
        workspaceId,
        retryOf: listed.items[0]?.id,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      cause: { code: "CONTAINER_RUN_NOT_RETRYABLE" },
    });
  }, 60_000);

  it("refuses with the demo off and says so in the list", async () => {
    const user = await signUp("Off Container", "off@containers.test");
    const off = containerEnv({ CONTAINER_DEMO: "off" });
    const caller = callerFor(user, off);
    const workspaceId = await workspaceOf(user);
    await expect(
      caller.containerRuns.start({ workspaceId, digits: 1000 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      cause: { code: "CONTAINER_DEMO_OFF" },
    });
    expect(
      (await caller.containerRuns.list({ workspaceId })).status.availability
    ).toEqual({ state: "off" });
  });

  it("refuses past the daily cap, for everyone, and the list says so", async () => {
    const first = await signUp("Cap One", "cap1@containers.test");
    const second = await signUp("Cap Two", "cap2@containers.test");
    // Today's counter already at a cap of 1 (other tests in this file share the day).
    const capped = containerEnv({ CONTAINER_DEMO_DAILY_CAP: "1" });
    await env.DB.prepare(
      "INSERT INTO container_run_quota (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = MAX(count, 1)"
    )
      .bind(new Date().toISOString().slice(0, 10))
      .run();
    for (const user of [first, second]) {
      const caller = callerFor(user, capped);
      const workspaceId = await workspaceOf(user);
      await expect(
        caller.containerRuns.start({ workspaceId, digits: 1000 })
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        cause: { code: "CONTAINER_DEMO_DAILY_CAP" },
      });
      expect(
        (await caller.containerRuns.list({ workspaceId })).status
      ).toMatchObject({
        availability: { state: "daily_cap_reached" },
        dailyCap: 1,
        usedToday: 1,
      });
    }
  });

  it("refuses a user's sixth run in an hour", async () => {
    const user = await signUp("Hourly Container", "hourly@containers.test");
    const workspaceId = await workspaceOf(user);
    await seedRecentRuns(user, workspaceId);
    const caller = callerFor(user);
    await expect(
      caller.containerRuns.start({ workspaceId, digits: 1000 })
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      cause: { code: "CONTAINER_RUN_HOURLY_LIMIT", details: { limit: 5 } },
    });
    expect(
      (await caller.containerRuns.list({ workspaceId })).status
    ).toMatchObject({
      availability: { state: "hourly_limit_reached" },
      usedThisHour: 5,
    });
  });

  it("limits bursts at the edge: a fourth start in a minute is 429 (container.run)", async () => {
    await using introspector = await introspectWorkflow(
      env.CONTAINER_RUN_WORKFLOW as Workflow
    );
    await introspector.modifyAll(async (m) => {
      await m.mockStepResult({ name: "start container" }, { instance: 0 });
    });
    const user = await signUp("Burst Container", "burst@containers.test");
    const workspaceId = await workspaceOf(user);
    const caller = callerFor(user);
    for (let index = 0; index < 3; index += 1) {
      await caller.containerRuns.start({ workspaceId, digits: 1000 });
    }
    await expect(
      caller.containerRuns.start({ workspaceId, digits: 1000 })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  }, 60_000);

  it("needs a signed-in member: anonymous is UNAUTHORIZED, other workspaces NOT_FOUND", async () => {
    await expect(callerFor(null).containerRuns.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      callerFor(null).containerRuns.start({ digits: 1000 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expectCrossWorkspaceDenied("containerRuns.start", { digits: 1000 });
    await expectCrossWorkspaceDenied("containerRuns.get", { runId: runRef });
    await expectCrossWorkspaceDenied("containerRuns.list", {});
  });

  it("answers the same through the MCP tools", async () => {
    await using introspector = await introspectWorkflow(
      env.CONTAINER_RUN_WORKFLOW as Workflow
    );
    const user = await signUp("Agent Container", "agent@containers.test");
    const caller = callerFor(user);

    const started = await mcpCall(caller, "start_container_run", {
      digits: 1000,
    });
    expect(started.isError).toBeFalsy();
    const runId = started.structuredContent.runId as string;
    const [instance] = await introspector.get();
    await instance?.waitForStatus("complete");

    expect(
      (await mcpCall(caller, "get_container_run", { runId })).structuredContent
    ).toMatchObject({ id: runId, status: "succeeded" });
    expect(
      (await mcpCall(caller, "list_container_runs", {})).structuredContent
    ).toMatchObject({
      items: [expect.objectContaining({ id: runId })],
      status: { availability: { state: "on" } },
    });
    const refused = await mcpCall(caller, "start_container_run", {
      digits: 12_345,
    });
    expect(refused.isError).toBe(true);
  }, 60_000);
});
