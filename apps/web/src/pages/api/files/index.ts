import { env } from "cloudflare:workers";
import { storeFile, uploadInputSchema } from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { getDb } from "@/server/db";

/**
 * Upload through the Worker into the `FILES` R2 binding (multipart field `file`).
 * Binary transfer stays a plain HTTP route; tRPC carries JSON only.
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

  const stored = await storeFile(getDb(env), env.FILES, {
    ...input.data,
    ownerUserId: locals.user.id,
    body: await file.arrayBuffer(),
  });

  return Response.json(
    { fileId: stored.fileId, url: `/api/files/${stored.fileId}` },
    { status: 201 }
  );
};
