import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { mediaResponse } from "@/server/media";

// The walkthrough videos from R2 (server/media.ts). No session: the middleware skips it.
export const GET: APIRoute = ({ params, request }) =>
  mediaResponse(env.FILES, request, params.path ?? "");

export const HEAD = GET;
