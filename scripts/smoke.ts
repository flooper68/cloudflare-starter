/**
 * `bun run test:smoke -- --base-url https://starter.flooper.me [playwright args]`
 * `bun run test:smoke -- --env production` (the URL from that environment's route in
 * wrangler.jsonc; E2E_BASE_URL or --base-url win over it)
 *
 * Runs the production smoke suite (apps/web/test/e2e/smoke, the `production` Playwright
 * project) against a deployed app: GET requests only, no sign-up, no writes. The HTML
 * report lands in apps/web/playwright-report. docs/architecture/testing.md (E2E tests).
 * With `--env` and no URL anywhere (develop on workers.dev) it warns and exits 0.
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
// The environment named with --env, for checks that differ by environment (robots.txt).
let smokeEnvironment: string | undefined;
if (envIndex !== -1) {
  const env = argv[envIndex + 1];
  if (!ENVIRONMENTS.includes(env as Environment)) {
    fail(`--env must be one of ${ENVIRONMENTS.join(", ")}`);
  }
  argv.splice(envIndex, 2);
  smokeEnvironment = env;
  fromEnvironment = deployedURL(
    envBlock(readWranglerConfig(), env as Environment)
  );
  if (
    !fromEnvironment &&
    !process.env.E2E_BASE_URL &&
    !argv.some((a) => a.startsWith("--base-url"))
  ) {
    console.log(
      `::warning::${env} has no hostname route in wrangler.jsonc: smoke suite skipped (set the APP_URL variable or pass --base-url).`
    );
    process.exit(0);
  }
}

const args = parseSmokeArgs(argv, process.env.E2E_BASE_URL || fromEnvironment);
if (!args.ok) fail(args.error);

console.log(`Smoke suite against ${args.baseURL} (read-only)`);
// In apps/web, where the lockfile's Playwright is installed.
const result = spawnSync(
  "bunx",
  ["playwright", "test", "--project", "production", ...args.playwright],
  {
    cwd: WEB,
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_BASE_URL: args.baseURL,
      ...(smokeEnvironment ? { SMOKE_ENV: smokeEnvironment } : {}),
    },
  }
);
process.exit(result.status ?? 1);
