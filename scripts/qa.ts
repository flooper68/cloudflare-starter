/**
 * `bun run test:qa -- --base-url https://starter.flooper.me [playwright args]`
 * `bun run test:qa -- --env production` (the URL from that environment's route in
 * wrangler.jsonc, as CI runs it: the QA token only ever goes to a route of this repository)
 *
 * Runs the automated QA suite (apps/web/test/qa, project `qa` of
 * apps/web/playwright.qa.config.ts) against a deployed app: real sign-ups and mail through
 * the app's QA outbox, every account erased afterwards. Needs QA_TOKEN in the environment
 * (without it the journeys skip and say why); the URL may come from QA_BASE_URL instead of
 * --base-url. Pass `--project qa-cleanup` for the nightly cleanup, `--project qa-delivery`
 * for the weekly real-delivery check. The HTML report lands in apps/web/playwright-report/qa.
 * docs/guides/how-to-qa-a-deployment.md
 */
import { spawnSync } from "node:child_process";

import {
  ENVIRONMENTS,
  type Environment,
  envBlock,
  fail,
  readWranglerConfig,
  WEB,
} from "./lib";
import { deployedURL, parseSmokeArgs } from "./smoke-args";

const argv = process.argv.slice(2);
const envIndex = argv.indexOf("--env");
let fromEnvironment: string | undefined;
if (envIndex !== -1) {
  const env = argv[envIndex + 1];
  if (!ENVIRONMENTS.includes(env as Environment)) {
    fail(`--env must be one of ${ENVIRONMENTS.join(", ")}`);
  }
  argv.splice(envIndex, 2);
  fromEnvironment =
    deployedURL(envBlock(readWranglerConfig(), env as Environment)) ??
    fail(
      `${env} has no hostname route in apps/web/wrangler.jsonc: pass --base-url`
    );
  if (argv.some((arg) => arg.startsWith("--base-url"))) {
    fail("pass --env or --base-url, not both");
  }
}

const args = parseSmokeArgs(argv, fromEnvironment ?? process.env.QA_BASE_URL);
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
