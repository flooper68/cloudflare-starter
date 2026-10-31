import { env } from "cloudflare:workers";
import {
  DomainError,
  downloadDataExport,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";
import { buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import { httpAttributes, internalErrorResponse } from "@/server/http";
export const GET: APIRoute = async ({ locals, params, url, request }) => {
  if (!locals.user || !params.id)
    return new Response("Not found", { status: 404 });
  try {
    const exported = await downloadDataExport(
      {
        db: getDb(env),
        bucket: env.FILES,
        clock: systemClock,
        secret: buildRequiredConfig(env).BETTER_AUTH_SECRET,
      },
      locals.user.id,
      {
        requestId: params.id,
        expires: Number(url.searchParams.get("expires")),
        signature: url.searchParams.get("signature") ?? "",
      }
    );
    return new Response(exported.body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=data-export.zip",
        "Content-Length": String(exported.size),
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError)
      return new Response("Not found", { status: 404 });
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/privacy/exports/[id]",
    });
  }
};
