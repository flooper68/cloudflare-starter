import { env } from "cloudflare:workers";
import {
  DomainError,
  enforceRateLimit,
  RateLimitedError,
  resolveActor,
  setWorkspaceLogo,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";
import { domainErrorResponse, internalErrorResponse } from "@/server/http";
import { readProfileImage } from "@/server/profile-images";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import { rateLimitedResponse } from "@/server/rate-limited-response";
import { createAppContext, userOf } from "@/server/trpc/context";

export const POST: APIRoute = async ({ request, locals, params }) => {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Cross-origin upload", { status: 403 });
  if (!locals.user || !params.workspaceId)
    return new Response("Not found", { status: 404 });
  try {
    const ctx = createAppContext(
      userOf(locals.user),
      locals.requestContext,
      env
    );
    const actor = await resolveActor(ctx, {
      userId: locals.user.id,
      mode: ctx.config.workspaces.mode,
      workspaceId: params.workspaceId,
    });
    await enforceRateLimit(ctx, {
      policy: "upload.user",
      subject: { userId: locals.user.id, ip: locals.requestContext.ip },
    });
    return Response.json(
      await setWorkspaceLogo(ctx, actor, {
        bytes: await readProfileImage(request),
        contentType: request.headers.get("content-type") ?? "",
      }),
      {
        headers: { "RateLimit-Policy": rateLimitPolicyHeader(["upload.user"]) },
      }
    );
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
