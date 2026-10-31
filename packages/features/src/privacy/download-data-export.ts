import { eq } from "drizzle-orm";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { authorizeExport } from "./authorize-export";
import { ExportUnavailableError } from "./domain";
import { dataRequests } from "./privacy.schema";
/** Checks signature, owner, current workspace permission, completion and expiry before reading R2. */
export async function downloadDataExport(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly secret: string;
  },
  userId: string,
  input: {
    readonly requestId: string;
    readonly expires: number;
    readonly signature: string;
  }
) {
  if (
    !/^[a-f0-9]{64}$/.test(input.signature) ||
    !Number.isSafeInteger(input.expires) ||
    input.expires <= deps.clock.now().getTime()
  )
    throw new ExportUnavailableError();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(deps.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const bytes = new Uint8Array(
    input.signature.match(/../g)?.map((x) => Number.parseInt(x, 16)) ?? []
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(
      `privacy-export:v1:${input.requestId}:${userId}:${input.expires}`
    )
  );
  if (!valid) throw new ExportUnavailableError();
  const [row] = await deps.db
    .select()
    .from(dataRequests)
    .where(eq(dataRequests.id, input.requestId));
  if (
    !row ||
    row.userId !== userId ||
    row.status !== "ready" ||
    row.expiresAt?.getTime() !== input.expires ||
    !row.objectKey
  )
    throw new ExportUnavailableError();
  await authorizeExport(deps, {
    userId,
    scope: row.scope,
    workspaceId: row.scope === "workspace" ? row.subjectId : null,
  });
  const object = await deps.bucket.get(row.objectKey);
  if (!object) throw new ExportUnavailableError();
  return { body: object.body, size: object.size };
}
