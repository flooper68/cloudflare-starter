import { env } from "cloudflare:workers";
import {
  FileNotFoundError,
  NotWorkspaceMemberError,
  randomIds,
  readWorkspaceFile,
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

/**
 * Streams a file from the `FILES` binding to members of its workspace
 * (`?workspaceId=`, else the user's current one). Anyone else gets 404.
 */
export const GET: APIRoute = async ({ locals, params, request, url }) => {
  if (!locals.user || !params.id) {
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
    const { file, object } = await readWorkspaceFile(
      { db, bucket: env.FILES },
      actor,
      { fileId: params.id }
    );
    return new Response(object.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
        ETag: object.httpEtag,
      },
    });
  } catch (error) {
    if (
      error instanceof FileNotFoundError ||
      error instanceof WorkspaceNotFoundError ||
      error instanceof NotWorkspaceMemberError
    ) {
      return new Response("Not found", { status: 404 });
    }
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/files/[id]",
    });
  }
};
