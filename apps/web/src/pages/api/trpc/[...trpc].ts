import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { APIRoute } from "astro";

import { createAppContext } from "@/server/trpc/context";
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
    createContext: () => createAppContext(context.locals),
  });
}

export const GET: APIRoute = handler;
export const POST: APIRoute = handler;
