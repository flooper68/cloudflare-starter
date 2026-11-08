import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The accounts each run created, so `cleanupRun` can erase them from any worker or a
 * later process: one JSON line per address in test-results/qa-runs/<runId>.jsonl. Only
 * addresses: passwords are derived again (password.ts), never written down.
 */
const DIRECTORY = join(process.cwd(), "test-results", "qa-runs");

function fileOf(runId: string): string {
  return join(DIRECTORY, `${runId}.jsonl`);
}

export function registerAccount(runId: string, email: string): void {
  mkdirSync(DIRECTORY, { recursive: true });
  appendFileSync(fileOf(runId), `${JSON.stringify({ email })}\n`);
}

/** The run's addresses, each once, in the order they were created. */
export function runAccounts(runId: string): string[] {
  let text = "";
  try {
    text = readFileSync(fileOf(runId), "utf8");
  } catch {
    return [];
  }
  const emails = text
    .split("\n")
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as { email: string }).email);
  return [...new Set(emails)];
}
