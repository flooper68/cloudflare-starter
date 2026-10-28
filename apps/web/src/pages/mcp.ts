import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { handleMcp } from "@/server/mcp/handler";

/** Remote MCP server (Streamable HTTP, stateless, OAuth-protected). */
export const ALL: APIRoute = ({ request }) => handleMcp(request, env);
