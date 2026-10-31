import { env } from "cloudflare:workers";
import {
  DomainError,
  enforceRateLimit,
  RateLimitedError,
  randomIds,
  setAccountAvatar,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";
import { getDb } from "@/server/db";
import { domainErrorResponse, internalErrorResponse } from "@/server/http";
import { buildPlatform } from "@/server/platform";
import { readProfileImage } from "@/server/profile-images";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import { rateLimitedResponse } from "@/server/rate-limited-response";

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Cross-origin upload", { status: 403 });
  if (!locals.user) return new Response("Not found", { status: 404 });
  try {
    await enforceRateLimit(buildPlatform(env), {
      policy: "upload.user",
      subject: { userId: locals.user.id, ip: locals.requestContext.ip },
    });
    const result = await setAccountAvatar(
      {
        db: getDb(env),
        bucket: env.FILES,
        clock: systemClock,
        ids: randomIds,
        requestContext: locals.requestContext,
      },
      {
        userId: locals.user.id,
        bytes: await readProfileImage(request),
        contentType: request.headers.get("content-type") ?? "",
      }
    );
    return Response.json(result, {
      headers: { "RateLimit-Policy": rateLimitPolicyHeader(["upload.user"]) },
    });
  } catch (error) {
    if (error instanceof RateLimitedError)
      return rateLimitedResponse(
        error,
        locals.requestContext,
        new URL(request.url).pathname
      );
    return error instanceof DomainError
      ? domainErrorResponse(error)
      : internalErrorResponse(env, error, locals.requestContext);
  }
};
