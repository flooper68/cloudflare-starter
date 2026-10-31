import { env } from "cloudflare:workers";
import {
  DomainError,
  readWorkspaceLogo,
  resolveActor,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";
import { domainErrorResponse, internalErrorResponse } from "@/server/http";
import { profileImageResponse } from "@/server/profile-images";
import { createAppContext, userOf } from "@/server/trpc/context";

export const GET: APIRoute = async ({ locals, params }) => {
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
    return profileImageResponse(
      await readWorkspaceLogo(ctx, actor, { version: params.version ?? "" })
    );
  } catch (error) {
    return error instanceof DomainError
      ? domainErrorResponse(error)
      : internalErrorResponse(env, error, locals.requestContext);
  }
};
