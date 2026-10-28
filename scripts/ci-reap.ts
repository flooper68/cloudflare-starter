/**
 * `bun scripts/ci-reap.ts <command> [args...]`
 *
 * Runs a test command (Playwright, Storybook's Vitest) and then stops the dev servers it left
 * behind: workerd, wrangler, astro or vite processes started from the job's workspace. Such
 * an orphan keeps the step's stdout open, and GitHub Actions then waits after "N passed"
 * until the job times out. Exits with the command's status.
 *
 * Only acts when GITHUB_ACTIONS=true (locally it would hit your own dev servers) and only on
 * processes whose command line contains GITHUB_WORKSPACE. A worker of the Docker runner
 * (ops/runner/) and a GitHub-hosted VM run one job at a time, so these are this job's.
 */
import { spawnSync } from "node:child_process";

import { leftoverPids } from "./ci-lib";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: bun scripts/ci-reap.ts <command> [args...]");
  process.exit(2);
}

const result = spawnSync(command, args, { stdio: "inherit" });
const status = result.status ?? 1;

const workspace = process.env.GITHUB_WORKSPACE ?? "";
if (process.env.GITHUB_ACTIONS !== "true" || !workspace) process.exit(status);

function leftovers(): number[] {
  const ps = spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  return leftoverPids(ps.stdout ?? "", workspace, [process.pid, process.ppid]);
}

function signal(pids: readonly number[], name: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, name);
    } catch {
      // Already gone.
    }
  }
}

const found = leftovers();
if (found.length > 0) {
  console.log(
    `ci-reap: stopping ${found.length} leftover process(es): ${found.join(", ")}`
  );
  signal(found, "SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  signal(leftovers(), "SIGKILL");
}
process.exit(status);
