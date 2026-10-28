import { env } from "cloudflare:workers";
import { FileNotFoundError, readOwnedFile } from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { getDb } from "@/server/db";
import { internalErrorResponse } from "@/server/http";

/** Streams a file from the `FILES` binding to its owner. Anyone else gets 404. */
export const GET: APIRoute = async ({ locals, params, request }) => {
  if (!locals.user || !params.id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { file, object } = await readOwnedFile(
      { db: getDb(env), bucket: env.FILES },
      { fileId: params.id, ownerUserId: locals.user.id }
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
    if (error instanceof FileNotFoundError) {
      return new Response("Not found", { status: 404 });
    }
    return internalErrorResponse(env, error, locals.requestContext, {
      route: "GET /api/files/[id]",
      cfRay: request.headers.get("cf-ray"),
    });
  }
};
