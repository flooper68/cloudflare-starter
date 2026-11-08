import { env } from "cloudflare:workers";
import {
  buildErasureHandlers,
  DomainError,
  eraseQaAccounts,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { createAdminAuthGateway } from "@/server/admin-auth-gateway";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { problemResponse } from "@/server/http";
import { QA_ENDPOINT_HEADERS, qaEndpoint } from "@/server/qa-endpoint";

const ROUTE = "/api/qa/cleanup";

/**
 * Erases the QA suite's run accounts (QA_BYPASS=on only; 404 otherwise), with no admin:
 * `POST` with `{ "runId": "<yyyymmdd><4 letters>" }` erases that run's
 * `qa+<runId>-<role>@` accounts, `{}` every run account older than two hours (the nightly
 * cleanup). Never the QA admin, never any other address; at most 20 per call; through the
 * real erasure (eraseQaAccounts). Answers `{ erased, remaining }`. Gate:
 * server/qa-endpoint.ts (QA token, `qa.bypass`).
 */
export const POST: APIRoute = (context) =>
  qaEndpoint(env as AppEnv, context, ROUTE, "qa.bypass", async (bypass) => {
    const appEnv = env as AppEnv;
    const body = (await context.request.json().catch(() => null)) as {
      runId?: unknown;
    } | null;
    if (body === null || typeof body !== "object") {
      return problemResponse(400, "Bad Request", "The body must be JSON.");
    }
    const runId = body.runId === undefined ? null : body.runId;
    if (runId !== null && typeof runId !== "string") {
      return problemResponse(400, "Bad Request", "runId must be a string.");
    }
    const db = getDb(appEnv);
    try {
      const result = await eraseQaAccounts(
        {
          db,
          clock: systemClock,
          ids: randomIds,
          requestContext: context.locals.requestContext,
          gateway: createAdminAuthGateway(() => getAuth(appEnv), null),
          ...buildErasureHandlers({
            db,
            bucket: appEnv.FILES,
            clock: systemClock,
          }),
        },
        { domain: bypass.emailDomain, runId }
      );
      return Response.json(result, { headers: QA_ENDPOINT_HEADERS });
    } catch (error) {
      if (error instanceof DomainError && error.kind === "invalid_input") {
        return problemResponse(400, "Bad Request", error.message);
      }
      throw error;
    }
  });
