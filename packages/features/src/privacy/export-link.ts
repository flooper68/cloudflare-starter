import { eq } from "drizzle-orm";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { authorizeExport } from "./authorize-export";
import { ExportUnavailableError } from "./domain";
import { dataRequests } from "./privacy.schema";
/** Authenticated expiring link, signed with a domain-separated HMAC. No token is stored. */
export async function createExportLink(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly secret: string;
  },
  userId: string,
  input: { readonly requestId: string }
) {
  const [row] = await deps.db
    .select()
    .from(dataRequests)
    .where(eq(dataRequests.id, input.requestId));
  if (
    !row ||
    row.userId !== userId ||
    row.status !== "ready" ||
    !row.expiresAt ||
    row.expiresAt <= deps.clock.now()
  )
    throw new ExportUnavailableError();
  await authorizeExport(deps, {
    userId,
    scope: row.scope,
    workspaceId: row.scope === "workspace" ? row.subjectId : null,
  });
  const expires = row.expiresAt.getTime();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(deps.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const message = new TextEncoder().encode(
    `privacy-export:v1:${row.id}:${userId}:${expires}`
  );
  const signed = await crypto.subtle.sign("HMAC", key, message);
  const signature = Array.from(new Uint8Array(signed), (x) =>
    x.toString(16).padStart(2, "0")
  ).join("");
  return {
    href: `/api/privacy/exports/${row.id}?expires=${expires}&signature=${signature}`,
    expiresAt: row.expiresAt.toISOString(),
  };
}
