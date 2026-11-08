/**
 * `bun run test:qa -- --base-url https://starter.flooper.me [playwright args]`
 *
 * Runs the scripted feature QA journeys (apps/web/test/qa, `playwright.qa.config.ts`)
 * against an environment. The other QA variables (QA_TOKEN, QA_INBOX_URL, QA_INBOX_TOKEN,
 * QA_EMAIL_DOMAIN) come from the environment; without them every journey skips.
 * apps/web/test/qa/README.md. STUB of the QA infrastructure PR's script.
 */
import { spawnSync } from "node:child_process";

import { fail, WEB } from "./lib";
import { parseSmokeArgs } from "./smoke-args";

const args = parseSmokeArgs(process.argv.slice(2), process.env.QA_BASE_URL);
if (!args.ok) fail(args.error.replace("test:smoke", "test:qa"));

console.log(`QA journeys against ${args.baseURL}`);
const result = spawnSync(
  "bunx",
  ["playwright", "test", "-c", "playwright.qa.config.ts", ...args.playwright],
  {
    cwd: WEB,
    stdio: "inherit",
    env: { ...process.env, QA_BASE_URL: args.baseURL },
  }
);
process.exit(result.status ?? 1);
