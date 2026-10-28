/**
 * CI safety rules for a public repository with optional self-hosted runners
 * (docs/guides/how-to-setup-ci.md#security):
 * - every CI job picks its runner with CI_RUNS_ON behind the fork guard, so a fork's pull
 *   request never reaches a self-hosted runner;
 * - no workflow uses pull_request_target; the deploy only starts by hand;
 * - GitHub caches are skipped on self-hosted runners;
 * - the runner image (ops/runner/Dockerfile) is pinned and matches the repository's versions.
 */
import { describe, expect, it } from "vitest";

import { bunVersion, dockerfileArgs } from "../../scripts/runner-plan";
import { filesUnder, read } from "./repo";

// GitHub Actions expressions: `${{ … }}` is meant literally (no template strings).
const EXPR = "$";
const RUNS_ON =
  EXPR +
  "{{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository && 'ubuntu-latest') || fromJSON(vars.CI_RUNS_ON || '\"ubuntu-latest\"') }}";
const GITHUB_HOSTED_ONLY = "if: runner.environment == 'github-hosted'";

const workflows = filesUnder(".github", /\.ya?ml$/);

/** Job name → its lines, for the top-level `jobs:` map of a workflow. */
function jobs(workflow: string): Map<string, string> {
  const lines = workflow.split("\n");
  const start = lines.indexOf("jobs:");
  const result = new Map<string, string>();
  let name: string | undefined;
  let body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([\w-]+):\s*$/.exec(line);
    if (header || /^\S/.test(line)) {
      if (name) result.set(name, body.join("\n"));
      name = header?.[1];
      body = [];
      if (!header) break;
    } else {
      body.push(line);
    }
  }
  if (name) result.set(name, body.join("\n"));
  return result;
}

/** The YAML step (list item) that contains line `index`. */
function stepAround(lines: readonly string[], index: number): string {
  let begin = index;
  while (begin > 0 && !/^\s*- /.test(lines[begin] as string)) begin--;
  const indent = (lines[begin] as string).search(/\S/);
  let end = index + 1;
  while (end < lines.length) {
    const line = lines[end] as string;
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    end++;
  }
  return lines.slice(begin, end).join("\n");
}

describe("CI runner choice", () => {
  const ci = jobs(read(".github/workflows/ci.yml"));

  it("ci.yml has jobs", () => {
    expect(ci.size).toBeGreaterThan(0);
  });

  it.each([...ci.keys()])(
    "job %s uses CI_RUNS_ON behind the fork guard",
    (job) => {
      expect(
        ci.get(job),
        "fork pull requests must stay on GitHub-hosted runners"
      ).toContain(`    runs-on: ${RUNS_ON}`);
    }
  );

  it.each(workflows)("%s has no pull_request_target", (path) => {
    const withoutComments = read(path).replace(/(^|\s)#.*$/gm, "$1");
    expect(withoutComments).not.toMatch(/pull_request_target/);
  });

  it("the deploy workflow only starts by hand", () => {
    const on = /^on:\n((?: {2}.*\n|\n)+)/m.exec(
      read(".github/workflows/deploy.yml")
    )?.[1];
    const triggers = [...(on ?? "").matchAll(/^ {2}([\w-]+):/gm)].map(
      (match) => match[1]
    );
    expect(triggers).toEqual(["workflow_dispatch"]);
  });
});

describe("GitHub caches", () => {
  const steps = workflows.flatMap((path) => {
    const lines = read(path).split("\n");
    return lines.flatMap((line, index) =>
      /uses: actions\/cache[@/]/.test(line)
        ? [[`${path}:${index + 1}`, stepAround(lines, index)] as const]
        : []
    );
  });

  it("are used somewhere (the check below is not vacuous)", () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it.each(steps)("%s runs only on GitHub-hosted runners", (_, step) => {
    expect(step).toContain(GITHUB_HOSTED_ONLY);
  });

  it("setup-bun does not cache on self-hosted runners", () => {
    expect(read(".github/actions/setup/action.yml")).toContain(
      `no-cache: ${EXPR}{{ runner.environment != 'github-hosted' }}`
    );
  });
});

describe("runner image", () => {
  const dockerfile = read("ops/runner/Dockerfile");
  const args = dockerfileArgs(dockerfile);
  const pkg = JSON.parse(read("package.json")) as { packageManager: string };
  const devDependency = (path: string, name: string): string | undefined =>
    (
      JSON.parse(read(path)) as {
        devDependencies?: Record<string, string>;
      }
    ).devDependencies?.[name];

  it("pins the base image by version and digest", () => {
    expect(dockerfile).toMatch(
      /^FROM ghcr\.io\/actions\/actions-runner:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/m
    );
  });

  it.each([
    [
      "BUN_VERSION",
      bunVersion(pkg.packageManager),
      "packageManager in package.json",
    ],
    ["NODE_VERSION", read(".nvmrc").trim(), ".nvmrc"],
    [
      "PLAYWRIGHT_VERSION",
      devDependency("apps/web/package.json", "@playwright/test"),
      "@playwright/test in apps/web",
    ],
    [
      "PLAYWRIGHT_VERSION",
      devDependency("apps/storybook/package.json", "playwright"),
      "playwright in apps/storybook",
    ],
  ])("ARG %s matches %s", (arg, version, source) => {
    expect(args.get(arg), `update ops/runner/Dockerfile to ${source}`).toBe(
      version
    );
  });

  it.each([
    "BUN_SHA256_ARM64",
    "BUN_SHA256_AMD64",
    "NODE_SHA256_ARM64",
    "NODE_SHA256_AMD64",
  ])("pins %s", (arg) => {
    expect(args.get(arg)).toMatch(/^[0-9a-f]{64}$/);
  });
});
