import { env } from "cloudflare:workers";
import {
  type Actor,
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
      { db },
      {
        userId: locals.user.id,
        mode: buildRequiredConfig(env).workspaces.mode,
        workspaceId: url.searchParams.get("workspaceId") ?? undefined,
      }
    );
  } catch (error) {
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
      { status: 201 }
    );
  } catch (error) {
    // Problem Details 500 with `reference`: the trace id users quote.
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/files",
    });
  }
};
