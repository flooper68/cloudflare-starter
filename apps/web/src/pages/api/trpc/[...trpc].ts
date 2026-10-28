import { mutationPolicy, RateLimitedError } from "@cloudflare-starter/features";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { APIRoute } from "astro";

import {
  rateLimitedHeaders,
  rateLimitPolicyHeader,
} from "@/server/rate-limit-headers";
import { createAppContext, userOf } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

async function handler(context: Parameters<APIRoute>[0]) {
  if (
    context.request.method === "POST" &&
    context.request.headers.get("x-trpc-source") !== "app"
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: context.request,
    router: appRouter,
    createContext: () =>
      createAppContext(
        userOf(context.locals.user),
        context.locals.requestContext
      ),
    // Mutations name their quota (RateLimit-Policy); a refused one answers 429 with
    // Retry-After and RateLimit (draft-ietf-httpapi-ratelimit-headers).
    responseMeta({ errors, info }) {
      const limited = errors
        .map((error) => error.cause)
        .find((cause) => cause instanceof RateLimitedError);
      if (limited) {
        return {
          headers: rateLimitedHeaders(
            limited.policy,
            limited.retryAfterSeconds
          ),
        };
      }
      const policies = (info?.type === "mutation" ? info.calls : [])
        .map((call) => call.path)
        .map(mutationPolicy)
        .filter((id) => id !== null);
      return policies.length
        ? { headers: { "RateLimit-Policy": rateLimitPolicyHeader(policies) } }
        : {};
    },
  });
}

export const GET: APIRoute = handler;
export const POST: APIRoute = handler;
