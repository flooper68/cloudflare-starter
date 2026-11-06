/**
 * Content-Security-Policy violation reports (`report-uri` and the Reporting API's
 * `report-to`, both pointed at /api/csp-report by server/security-headers.ts). Each report
 * becomes one `csp.violation` warning in the logs: which directive blocked what, on which
 * page. URLs are reduced to origin and redacted path (no query, no fragment), so tokens in
 * links never reach the logs. Anonymous by nature (browsers send no credentials the app
 * reads), so it is limited per IP (`csp.report`) and reads at most 16 KiB.
 */
import type { LogFields, RequestContext } from "@cloudflare-starter/features";

import { redactUrlPath } from "@/lib/redact-url";
import type { AppEnv } from "@/server/env";
import { problemResponse, withHeaders } from "@/server/http";
import { buildPlatform, loggerFor } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/** Larger bodies are refused unread; one report is well under 2 KiB. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024;
/** Reports logged from one request; a Reporting API batch may hold more. */
export const CSP_REPORTS_PER_REQUEST = 10;

const ACCEPTED_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
];

const limited = { "RateLimit-Policy": rateLimitPolicyHeader(["csp.report"]) };

/** A violation, in the Reporting API's names. */
export interface CspViolation {
  readonly documentURL: string;
  readonly effectiveDirective: string;
  readonly blockedURL: string;
  readonly disposition: string;
  readonly sourceFile?: string;
  readonly lineNumber?: number;
  readonly statusCode?: number;
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * A URL as origin plus redacted path; keywords (`inline`, `eval`, `data`) as they are.
 * Never the query or fragment.
 */
export function reportedUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${redactUrlPath(url.pathname)}`.slice(0, 300);
    }
    return url.protocol.replace(/:$/, "");
  } catch {
    return value.replace(/[^a-z0-9-]/gi, "").slice(0, 32);
  }
}

/** The violations of a body in either format; unknown shapes yield none. */
export function parseCspReports(body: unknown): CspViolation[] {
  // report-uri: { "csp-report": { "document-uri": …, … } }
  if (body && typeof body === "object" && "csp-report" in body) {
    const report = (body as Record<string, unknown>)["csp-report"];
    if (!report || typeof report !== "object") return [];
    const r = report as Record<string, unknown>;
    return [
      {
        documentURL: text(r["document-uri"], 2000),
        effectiveDirective: text(
          r["effective-directive"] ?? r["violated-directive"],
          80
        ),
        blockedURL: text(r["blocked-uri"], 2000),
        disposition: text(r.disposition, 20) || "enforce",
        sourceFile: text(r["source-file"], 2000) || undefined,
        lineNumber: number(r["line-number"]),
        statusCode: number(r["status-code"]),
      },
    ];
  }
  // report-to: [{ type: "csp-violation", body: { documentURL, … } }, …]
  if (Array.isArray(body)) {
    return body.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as Record<string, unknown>;
      if (e.type !== "csp-violation" || !e.body || typeof e.body !== "object") {
        return [];
      }
      const b = e.body as Record<string, unknown>;
      return [
        {
          documentURL: text(b.documentURL, 2000),
          effectiveDirective: text(b.effectiveDirective, 80),
          blockedURL: text(b.blockedURL, 2000),
          disposition: text(b.disposition, 20) || "enforce",
          sourceFile: text(b.sourceFile, 2000) || undefined,
          lineNumber: number(b.lineNumber),
          statusCode: number(b.statusCode),
        },
      ];
    });
  }
  return [];
}

/** The log fields of one violation (OpenTelemetry names where they exist, else app.csp.*). */
export function violationFields(violation: CspViolation): LogFields {
  return {
    "app.csp.directive": violation.effectiveDirective,
    "app.csp.blocked": reportedUrl(violation.blockedURL),
    "app.csp.disposition": violation.disposition,
    "app.csp.document": reportedUrl(violation.documentURL),
    "app.csp.source": violation.sourceFile
      ? reportedUrl(violation.sourceFile)
      : undefined,
    "app.csp.line": violation.lineNumber,
  };
}

/** Reads at most `max` bytes; null when the body is larger. */
async function readLimited(
  request: Request,
  max: number
): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** POST /api/csp-report: 204 after logging, 413/415/400 for what is not a report. */
export async function handleCspReport(
  request: Request,
  env: AppEnv,
  context: RequestContext
): Promise<Response> {
  const platform = buildPlatform(env);
  const refused = await refuseOverLimit(
    platform,
    "csp.report",
    { userId: null, ip: context.ip },
    (error) =>
      rateLimitedResponse(error, context, new URL(request.url).pathname)
  );
  if (refused) return refused;

  const type = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  if (!type || !ACCEPTED_TYPES.includes(type)) {
    return withHeaders(
      problemResponse(
        415,
        "Unsupported Media Type",
        "Send application/csp-report or application/reports+json."
      ),
      limited
    );
  }
  const raw = await readLimited(request, CSP_REPORT_MAX_BYTES);
  if (raw === null) {
    return withHeaders(
      problemResponse(
        413,
        "Content Too Large",
        `A report body may be at most ${CSP_REPORT_MAX_BYTES} bytes.`
      ),
      limited
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return withHeaders(
      problemResponse(400, "Bad Request", "The body is not JSON."),
      limited
    );
  }
  const logger = loggerFor(platform, context);
  for (const violation of parseCspReports(body).slice(
    0,
    CSP_REPORTS_PER_REQUEST
  )) {
    logger.warn("csp.violation", violationFields(violation));
  }
  return new Response(null, { status: 204, headers: limited });
}
