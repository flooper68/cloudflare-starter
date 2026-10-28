/**
 * Pure parts of the CI helper scripts (ci-reap.ts, ci-playwright-install.ts), unit-tested in
 * ci-lib.test.ts.
 */

/**
 * Dev servers and tools a test run can leave behind: workerd, wrangler, astro, vite, and
 * anything else started from the workspace's node_modules (esbuild, ...).
 */
const LEFTOVER = /node_modules\/|workerd|wrangler|astro|vite/;

/**
 * Processes from `ps -eo pid=,args=` output that run from the job's workspace (their command
 * line contains its path, e.g. <workspace>/node_modules/.bin/astro) and look like a dev
 * server, except `keep` (this script and its parent).
 */
export function leftoverPids(
  ps: string,
  workspace: string,
  keep: readonly number[]
): number[] {
  if (!workspace) return [];
  return ps
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .filter(([, , args]) => {
      const at = (args as string).indexOf(workspace);
      // Match after the workspace path, which may itself contain "vite" or "astro".
      return (
        at >= 0 && LEFTOVER.test((args as string).slice(at + workspace.length))
      );
    })
    .map(([, pid]) => Number(pid))
    .filter((pid) => !keep.includes(pid));
}

export interface PlaywrightInstall {
  /** Pass --with-deps (installs the Ubuntu packages with sudo apt-get). */
  readonly withDeps: boolean;
  /** A GitHub Actions warning to print, if any. */
  readonly warning?: string;
}

/**
 * Whether the job must install Chromium's OS packages. GitHub-hosted runners always do;
 * the runner image (ops/runner/Dockerfile) has them for the Playwright version in
 * CI_RUNNER_IMAGE_PLAYWRIGHT; any other self-hosted runner installs them and warns.
 */
export function playwrightInstall(input: {
  readonly githubActions: boolean;
  readonly runnerEnvironment: string | undefined;
  readonly imagePlaywright: string | undefined;
  readonly playwright: string;
}): PlaywrightInstall {
  if (!input.githubActions) return { withDeps: false };
  if (input.runnerEnvironment !== "self-hosted") return { withDeps: true };
  if (input.imagePlaywright === input.playwright) return { withDeps: false };
  return {
    withDeps: true,
    warning: input.imagePlaywright
      ? `The runner image has OS packages for Playwright ${input.imagePlaywright}, this commit uses ${input.playwright}: installing them now. Rebuild the image with \`bun run runner:up\`.`
      : `This self-hosted runner is not the runner image (ops/runner/Dockerfile): installing Playwright's OS packages with sudo.`,
  };
}
