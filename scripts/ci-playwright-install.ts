/**
 * `bun scripts/ci-playwright-install.ts`
 *
 * Installs Playwright's Chromium for the `components` and `e2e` CI jobs, with the Playwright
 * pinned in apps/web. On GitHub-hosted runners it also installs Chromium's Ubuntu packages
 * (`--with-deps`, sudo apt-get). The Docker runner image (ops/runner/Dockerfile) already has
 * them for the Playwright version in CI_RUNNER_IMAGE_PLAYWRIGHT; when the commit uses another
 * version (or the runner is not the image) it installs them and prints a warning.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { playwrightInstall } from "./ci-lib";
import { fail, WEB } from "./lib";

const web = JSON.parse(readFileSync(`${WEB}/package.json`, "utf8")) as {
  devDependencies: Record<string, string>;
};
const playwright = web.devDependencies["@playwright/test"];
if (!playwright) fail("apps/web/package.json has no @playwright/test");

const plan = playwrightInstall({
  githubActions: process.env.GITHUB_ACTIONS === "true",
  runnerEnvironment: process.env.RUNNER_ENVIRONMENT,
  imagePlaywright: process.env.CI_RUNNER_IMAGE_PLAYWRIGHT,
  playwright,
});
if (plan.warning) console.log(`::warning::${plan.warning}`);
if (!plan.withDeps) {
  console.log(
    `Playwright ${playwright}: OS packages present, installing Chromium only`
  );
}

// In apps/web, where the lockfile's Playwright is installed; at the root bunx would fetch the
// latest from npm.
const args = [
  "playwright",
  "install",
  ...(plan.withDeps ? ["--with-deps"] : []),
  "chromium",
];
console.log(`$ bunx ${args.join(" ")}`);
const result = spawnSync("bunx", args, { cwd: WEB, stdio: "inherit" });
process.exit(result.status ?? 1);
