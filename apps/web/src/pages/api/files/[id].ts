import { env } from "cloudflare:workers";
import { getOwnedFileObject } from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { getDb } from "@/server/db";

/** Streams a file from the `FILES` binding to its owner. Anyone else gets 404. */
export const GET: APIRoute = async ({ locals, params }) => {
  if (!locals.user || !params.id) {
    return new Response("Not found", { status: 404 });
  }

  const found = await getOwnedFileObject(getDb(env), env.FILES, {
    fileId: params.id,
    ownerUserId: locals.user.id,
  });
  if (!found) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(found.object.body, {
    headers: {
      "Content-Type": found.file.contentType,
      "Content-Disposition": `inline; filename="${found.file.filename}"`,
      "Cache-Control": "private, no-store",
      ETag: found.object.httpEtag,
    },
  });
};
