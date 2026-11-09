import { env } from "cloudflare:workers";
import {
  ContainerRunNotFoundError,
  ContainerRunResultUnavailableError,
  NotWorkspaceMemberError,
  randomIds,
  readContainerRunResult,
  resolveActor,
  systemClock,
  WorkspaceNotFoundError,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { buildRequiredConfig } from "@/lib/env";
import { billingGateFor } from "@/server/billing-provider";
import { getDb } from "@/server/db";
import { httpAttributes, internalErrorResponse } from "@/server/http";
import { buildPlatform } from "@/server/platform";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Downloads a container run's result (the digits of pi, text) from the `FILES` binding to
 * members of its workspace (`?workspaceId=`, else the user's current one). Anyone else,
 * and a run without a result, gets 404.
 */
export const GET: APIRoute = async ({ locals, params, request, url }) => {
  if (!locals.user || !params.id || !UUID.test(params.id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const db = getDb(env);
    const actor = await resolveActor(
      {
        db,
        clock: systemClock,
        ids: randomIds,
        requestContext: locals.requestContext,
        analytics: buildPlatform(env).productAnalytics(),
        billing: billingGateFor(env, locals.requestContext),
      },
      {
        userId: locals.user.id,
        mode: buildRequiredConfig(env).workspaces.mode,
        workspaceId: url.searchParams.get("workspaceId") ?? undefined,
      }
    );
    const { object, filename } = await readContainerRunResult(
      { db, bucket: env.FILES },
      actor,
      { runId: params.id }
    );
    return new Response(object.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        ETag: object.httpEtag,
      },
    });
  } catch (error) {
    if (
      error instanceof ContainerRunNotFoundError ||
      error instanceof ContainerRunResultUnavailableError ||
      error instanceof WorkspaceNotFoundError ||
      error instanceof NotWorkspaceMemberError
    ) {
      return new Response("Not found", { status: 404 });
    }
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/container-runs/[id]/result",
    });
  }
};
