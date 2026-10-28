import { env } from "cloudflare:workers";
import {
  type Actor,
  NotWorkspaceMemberError,
  randomIds,
  resolveActor,
  storeFile,
  systemClock,
  uploadInputSchema,
  WorkspaceNotFoundError,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import {
  httpAttributes,
  internalErrorResponse,
  problemResponse,
} from "@/server/http";
import { buildPlatform } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/**
 * Upload through the Worker into the `FILES` R2 binding (multipart field `file`), into
 * the workspace named by `?workspaceId=` or the user's current one. Binary transfer
 * stays a plain HTTP route; tRPC carries JSON only.
 */
export const POST: APIRoute = async ({ locals, request, url }) => {
  // Astro's checkOrigin is off for the OAuth token endpoint; check it here.
  if (request.headers.get("origin") !== url.origin) {
    return Response.json({ error: "Cross-origin upload" }, { status: 403 });
  }
  if (!locals.user) {
    return Response.json({ error: "Sign in to upload" }, { status: 401 });
  }
  const refused = await refuseOverLimit(
    buildPlatform(env),
    "upload.user",
    { userId: locals.user.id, ip: locals.requestContext.ip },
    (error) => rateLimitedResponse(error, locals.requestContext, url.pathname)
  );
  if (refused) return refused;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 });
  }

  const input = uploadInputSchema.safeParse({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });
  if (!input.success) {
    return Response.json(
      { error: "Invalid file", issues: input.error.issues },
      { status: 400 }
    );
  }

  const db = getDb(env);
  let actor: Actor;
  try {
    actor = await resolveActor(
      {
        db,
        clock: systemClock,
        ids: randomIds,
        requestContext: locals.requestContext,
      },
      {
        userId: locals.user.id,
        mode: buildRequiredConfig(env).workspaces.mode,
        workspaceId: url.searchParams.get("workspaceId") ?? undefined,
      }
    );
  } catch (error) {
    if (error instanceof NotWorkspaceMemberError) {
      return problemResponse(403, "Forbidden", error.message, {
        code: NotWorkspaceMemberError.CODE,
      });
    }
    if (error instanceof WorkspaceNotFoundError) {
      return problemResponse(
        404,
        "Not Found",
        "Workspace not found, or you are not a member of it."
      );
    }
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/files",
    });
  }

  try {
    const stored = await storeFile(
      { db, bucket: env.FILES, clock: systemClock, ids: randomIds },
      actor,
      { ...input.data, body: await file.arrayBuffer() }
    );

    const query = new URLSearchParams({ workspaceId: actor.workspaceId });
    return Response.json(
      { fileId: stored.fileId, url: `/api/files/${stored.fileId}?${query}` },
      {
        status: 201,
        headers: {
          "RateLimit-Policy": rateLimitPolicyHeader(["upload.user"]),
        },
      }
    );
  } catch (error) {
    // Problem Details 500 with `reference`: the trace id users quote.
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/files",
    });
  }
};
