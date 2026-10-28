import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { getAuth } from "@/server/auth";

export const ALL: APIRoute = ({ request }) => getAuth(env).handler(request);
