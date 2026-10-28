import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

import { handleAppRequest } from "@/server/app-middleware";

// Request context and x-request-id, cookie session, /app guard: server/app-middleware.ts.
export const onRequest = defineMiddleware((context, next) =>
  handleAppRequest(context, env, () => next())
);
