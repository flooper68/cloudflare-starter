/**
 * `bun run test:qa -- --base-url https://starter.flooper.me [playwright args]`
 *
 * Runs the automated QA suite (apps/web/test/qa, project `qa` of
 * apps/web/playwright.qa.config.ts) against a deployed app: real sign-ups and mail through
 * the QA inbox, every account erased afterwards. Needs QA_TOKEN, QA_INBOX_URL and
 * QA_INBOX_TOKEN in the environment (without them the journeys skip and say why); the URL
 * may come from QA_BASE_URL instead of --base-url. Pass `--project qa-cleanup` for the
 * nightly cleanup. The HTML report lands in apps/web/playwright-report/qa.
 * docs/guides/how-to-qa-a-deployment.md
 */
import { spawnSync } from "node:child_process";

import { fail, WEB } from "./lib";
import { parseSmokeArgs } from "./smoke-args";

const args = parseSmokeArgs(process.argv.slice(2), process.env.QA_BASE_URL);
if (!args.ok) {
  fail(
    args.error.replace(
      "bun run test:smoke -- --base-url",
      "bun run test:qa -- --base-url"
    )
  );
}
const project = args.playwright.some(
  (arg) => arg === "--project" || arg.startsWith("--project=")
)
  ? []
  : ["--project", "qa"];

console.log(`QA suite against ${args.baseURL}`);
const result = spawnSync(
  "bunx",
  [
    "playwright",
    "test",
    "-c",
    "playwright.qa.config.ts",
    ...project,
    ...args.playwright,
  ],
  {
    cwd: WEB,
    stdio: "inherit",
    env: { ...process.env, QA_BASE_URL: args.baseURL },
  }
);
process.exit(result.status ?? 1);
