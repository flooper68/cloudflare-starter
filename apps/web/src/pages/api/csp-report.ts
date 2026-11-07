import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { handleCspReport } from "@/server/csp-report";
import type { AppEnv } from "@/server/env";

/**
 * Content-Security-Policy violation reports from browsers (report-uri and report-to).
 * Logged as `csp.violation`; limited per IP by csp.report (server/csp-report.ts).
 */
export const POST: APIRoute = ({ request, locals }) =>
  handleCspReport(request, env as AppEnv, locals.requestContext);
