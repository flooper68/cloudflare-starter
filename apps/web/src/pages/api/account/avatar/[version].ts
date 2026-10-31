import { env } from "cloudflare:workers";
import { DomainError, readAccountAvatar } from "@cloudflare-starter/features";
import type { APIRoute } from "astro";
import { getDb } from "@/server/db";
import { domainErrorResponse, internalErrorResponse } from "@/server/http";
import { profileImageResponse } from "@/server/profile-images";

export const GET: APIRoute = async ({ locals, params }) => {
  if (!locals.user || !params.version)
    return new Response("Not found", { status: 404 });
  try {
    return profileImageResponse(
      await readAccountAvatar(
        { db: getDb(env), bucket: env.FILES },
        { userId: locals.user.id, version: params.version }
      )
    );
  } catch (error) {
    return error instanceof DomainError
      ? domainErrorResponse(error)
      : internalErrorResponse(env, error, locals.requestContext);
  }
};
