/**
 * Global setup and teardown of `playwright.qa.config.ts`. Setup picks the run id
 * (QA_RUN_ID, inherited by every worker; a preset value is kept, e.g. to re-run a
 * cleanup); teardown erases the run's accounts with `cleanupRun`, also after failures.
 */
import { randomBytes } from "node:crypto";

import { cleanupRun } from "./cleanup";
import { qaEnv } from "./env";

function newRunId(): string {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = [...randomBytes(4)]
    .map((byte) => "abcdefghijklmnopqrstuvwxyz0123456789"[byte % 36])
    .join("");
  return `${day}${suffix}`;
}

export function hasQaEnv(): boolean {
  try {
    qaEnv();
    return true;
  } catch {
    return false;
  }
}

export async function globalSetup(): Promise<void> {
  process.env.QA_RUN_ID ||= newRunId();
  if (hasQaEnv()) console.log(`QA run ${process.env.QA_RUN_ID}`);
}

export async function globalTeardown(): Promise<void> {
  const runId = process.env.QA_RUN_ID;
  if (!runId || !hasQaEnv()) return;
  await cleanupRun(runId);
}
