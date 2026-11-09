import { eq } from "drizzle-orm";

import type { Database } from "../database";
import { containerRuns } from "./container-runs.schema";
import {
  ContainerRunNotFoundError,
  containerRunResultKey,
  resultPreview,
} from "./domain";

/**
 * Stores a run's digits in R2 (FILES, under its workspace's prefix) and the result's key,
 * preview, size and compute time in its row. Writing the same result again overwrites the
 * same object (a retried workflow step).
 */
export async function storeContainerRunResult(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: {
    readonly runId: string;
    readonly pi: string;
    readonly computeMs: number;
  }
): Promise<{ readonly key: string; readonly bytes: number }> {
  const [row] = await deps.db
    .select({ workspaceId: containerRuns.workspaceId })
    .from(containerRuns)
    .where(eq(containerRuns.id, input.runId));
  if (!row) throw new ContainerRunNotFoundError();
  const key = containerRunResultKey(row.workspaceId, input.runId);
  const body = `${input.pi}\n`;
  const bytes = new TextEncoder().encode(body).byteLength;
  await deps.bucket.put(key, body, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
  await deps.db
    .update(containerRuns)
    .set({
      resultKey: key,
      resultPreview: resultPreview(input.pi),
      resultBytes: bytes,
      computeMs: Math.round(input.computeMs),
    })
    .where(eq(containerRuns.id, input.runId));
  return { key, bytes };
}
