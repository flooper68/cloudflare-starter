/**
 * `bun run setup:github-runner [--repo owner/name] [--name <runner>] [--labels a,b]
 *                              [--dir <path>] [--remove] [--dry-run]`
 *
 * Registers this machine as a self-hosted GitHub Actions runner for the repository and
 * runs it as a service. Downloads the latest actions/runner release for this OS/arch,
 * verifies its SHA-256 against the checksum published in the release notes (stops if
 * it cannot), configures it with a short-lived registration token from `gh`, then
 * installs and starts the service (on Linux it prints the sudo commands instead).
 * `--remove` stops and uninstalls the service and unregisters the runner.
 *
 * CI only uses the runner once the CI_RUNS_ON repository variable points at it, and
 * pull requests from forks always stay on GitHub-hosted runners. See
 * docs/how-to-setup-ci.md.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { fail, ROOT } from "./lib";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    name: { type: "string" },
    labels: { type: "string", default: "cloudflare-starter" },
    dir: { type: "string" },
    remove: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const SECRET = "<hidden>";

interface Captured {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a command and captures its output (for read-only queries and tokens). */
function capture(command: string, args: readonly string[]): Captured {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

/**
 * Runs a command with the terminal attached. `printable` replaces arguments that must
 * not be shown (tokens). With --dry-run it only prints the command.
 */
function step(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly printable?: readonly string[];
  } = {}
): void {
  const shown = `${command} ${(options.printable ?? args).join(" ")}`;
  if (dryRun) {
    console.log(`  (dry run) ${shown}`);
    return;
  }
  console.log(`  $ ${shown}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) fail(`${command} failed (exit ${result.status})`);
}

function hasTool(tool: string): boolean {
  return (
    spawnSync("sh", ["-c", `command -v ${tool}`], { stdio: "ignore" })
      .status === 0
  );
}

/** owner/name from the origin remote (git@github.com:o/n.git or https://github.com/o/n). */
function repoFromOrigin(): string {
  const origin = capture("git", ["remote", "get-url", "origin"]);
  if (!origin.ok) fail("No origin remote; pass --repo owner/name");
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(
    origin.stdout
  );
  if (!match) fail(`origin (${origin.stdout}) is not a GitHub URL; use --repo`);
  return match[1] as string;
}

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/")
    ? join(homedir(), path.slice(1))
    : resolve(path);
}

/** A short-lived token from the GitHub API, never printed. */
function runnerToken(repo: string, kind: "registration" | "remove"): string {
  if (dryRun) {
    console.log(
      `  (dry run) gh api -X POST repos/${repo}/actions/runners/${kind}-token --jq .token`
    );
    return SECRET;
  }
  const token = capture("gh", [
    "api",
    "-X",
    "POST",
    `repos/${repo}/actions/runners/${kind}-token`,
    "--jq",
    ".token",
  ]);
  if (!token.ok || !token.stdout) {
    fail(
      `Could not get a ${kind} token (you need admin access to ${repo}): ${token.stderr}`
    );
  }
  return token.stdout;
}

// --- Inputs and prerequisites -------------------------------------------------------

const repo = values.repo ?? repoFromOrigin();
if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
  fail(`--repo must be owner/name: ${repo}`);
const repoName = repo.split("/")[1] as string;
const runnerName =
  values.name ?? `${hostname().split(".")[0]?.toLowerCase()}-${repoName}`;
const labels = (values.labels ?? "cloudflare-starter")
  .split(",")
  .map((label) => label.trim())
  .filter(Boolean)
  .join(",");
if (!labels) fail("--labels needs at least one label");
const dir = expandHome(
  values.dir ?? join(homedir(), "actions-runner", repoName)
);
const isLinux = process.platform === "linux";
const configured = existsSync(join(dir, ".runner"));
const serviceInstalled = existsSync(join(dir, ".service"));

const os =
  process.platform === "darwin" ? "osx" : isLinux ? "linux" : undefined;
const arch =
  process.arch === "arm64"
    ? "arm64"
    : process.arch === "x64"
      ? "x64"
      : undefined;
if (!os || !arch) {
  fail(
    `Unsupported platform ${process.platform}/${process.arch} (macOS or Linux, x64 or arm64)`
  );
}

const missing = ["gh", "curl", "tar"].filter((tool) => !hasTool(tool));
if (missing.length > 0) fail(`Missing tools: ${missing.join(", ")}`);
if (!capture("gh", ["auth", "status"]).ok) {
  fail("gh is not signed in: run `gh auth login`");
}

const repoInfo = capture("gh", [
  "api",
  `repos/${repo}`,
  "--jq",
  "{private: .private, admin: .permissions.admin}",
]);
if (!repoInfo.ok) fail(`Cannot read ${repo}: ${repoInfo.stderr}`);
const { private: isPrivate, admin } = JSON.parse(repoInfo.stdout) as {
  private: boolean;
  admin: boolean;
};
if (!admin) fail(`You need admin access to ${repo} to manage its runners.`);

console.log(`Self-hosted runner for ${repo}`);
console.log(`  name:   ${runnerName}`);
console.log(`  labels: self-hosted, ${labels} (plus OS and arch labels)`);
console.log(`  dir:    ${dir}`);
console.log(`  host:   ${os}-${arch}`);
if (dryRun)
  console.log("  Dry run: nothing is downloaded, registered or installed.");
console.log("");

// --- Removal -------------------------------------------------------------------------

if (values.remove) {
  if (!configured && !dryRun) {
    fail(
      `No configured runner in ${dir}. Remove a stale entry in GitHub instead: Settings → Actions → Runners.`
    );
  }
  if (serviceInstalled || dryRun) {
    if (isLinux) {
      console.log("Stop and uninstall the service first (needs sudo):\n");
      console.log(
        `  cd ${dir} && sudo ./svc.sh stop && sudo ./svc.sh uninstall\n`
      );
      console.log("then run this command again to unregister the runner.");
      if (!dryRun) process.exit(1);
    } else {
      step("./svc.sh", ["stop"], { cwd: dir });
      step("./svc.sh", ["uninstall"], { cwd: dir });
    }
  }
  const token = runnerToken(repo, "remove");
  step("./config.sh", ["remove", "--token", token], {
    cwd: dir,
    printable: ["remove", "--token", SECRET],
  });
  console.log(
    dryRun ? "\nDry run done." : `\n✓ Runner ${runnerName} unregistered.`
  );
  console.log(
    "\nIf CI_RUNS_ON still points at self-hosted runners, jobs will queue forever. Switch back:"
  );
  console.log(`  gh variable delete CI_RUNS_ON --repo ${repo}`);
  console.log(
    `\nThe runner files stay in ${dir}; delete the folder when you no longer need it.`
  );
  process.exit(0);
}

// --- Public repository warning ------------------------------------------------------

console.log(
  isPrivate
    ? "Note: this repository is private. Anyone with write access can run code on this machine through CI."
    : [
        "WARNING: this repository is PUBLIC.",
        "A self-hosted runner runs whatever code a workflow job checks out, on this machine.",
        "It is only safe here because .github/workflows/ci.yml sends pull requests from forks",
        "to GitHub-hosted runners, and the deploy workflow can only be started by people with",
        "write access. Keep it that way: do not add pull_request_target workflows or jobs that",
        "run fork code on self-hosted runners, and keep 'Require approval for all external",
        "contributors' on (Settings → Actions → General → Fork pull request workflows).",
      ].join("\n")
);
console.log("");

if (configured && !dryRun) {
  fail(
    `${dir} already holds a configured runner. Run with --remove first, or pass another --dir.`
  );
}

// --- Download and verify ------------------------------------------------------------

interface Release {
  readonly tag_name: string;
  readonly body: string;
  readonly assets: readonly {
    readonly name: string;
    readonly browser_download_url: string;
    readonly digest?: string | null;
  }[];
}

const releaseResult = capture("gh", [
  "api",
  "repos/actions/runner/releases/latest",
]);
if (!releaseResult.ok) {
  fail(`Cannot read the latest runner release: ${releaseResult.stderr}`);
}
const release = JSON.parse(releaseResult.stdout) as Release;
const version = release.tag_name.replace(/^v/, "");
const platform = `${os}-${arch}`;
const fileName = `actions-runner-${platform}-${version}.tar.gz`;
const asset = release.assets.find((a) => a.name === fileName);
if (!asset) fail(`Release ${release.tag_name} has no ${fileName}`);

// The release notes carry: <!-- BEGIN SHA osx-arm64 -->hex<!-- END SHA osx-arm64 -->
const published = new RegExp(
  `<!-- BEGIN SHA ${platform} -->([0-9a-f]{64})<!-- END SHA ${platform} -->`
).exec(release.body)?.[1];
if (!published) {
  fail(
    `No SHA-256 for ${platform} in the ${release.tag_name} release notes; refusing to install an unverified runner.`
  );
}
// GitHub also records a digest per asset; when present it must agree.
const digest = asset.digest?.replace(/^sha256:/, "");
if (digest && digest !== published) {
  fail(
    `Checksum mismatch between the release notes and the asset digest for ${fileName}; stopping.`
  );
}
console.log(`Runner ${release.tag_name} (${fileName})`);
console.log(`  expected SHA-256: ${published}`);

const archive = join(dir, fileName);
if (dryRun) {
  console.log(`  (dry run) mkdir -p ${dir}`);
} else {
  mkdirSync(dir, { recursive: true });
}
step("curl", ["-fsSL", "-o", archive, asset.browser_download_url]);
if (!dryRun) {
  const actual = createHash("sha256")
    .update(readFileSync(archive))
    .digest("hex");
  if (actual !== published) {
    rmSync(archive);
    fail(
      `SHA-256 mismatch for ${fileName}: got ${actual}. Nothing was installed.`
    );
  }
  console.log("  ✓ checksum verified");
} else {
  console.log("  (dry run) verify SHA-256 of the download");
}
step("tar", ["xzf", archive, "-C", dir]);
if (!dryRun) rmSync(archive);

// --- Register and start -------------------------------------------------------------

const token = runnerToken(repo, "registration");
const configArgs = (t: string): string[] => [
  "--unattended",
  "--url",
  `https://github.com/${repo}`,
  "--token",
  t,
  "--name",
  runnerName,
  "--labels",
  labels,
  "--replace",
];
step("./config.sh", configArgs(token), {
  cwd: dir,
  printable: configArgs(SECRET),
});

if (isLinux) {
  console.log("\nInstall and start the service (needs sudo):\n");
  console.log(`  cd ${dir} && sudo ./svc.sh install && sudo ./svc.sh start`);
} else {
  step("./svc.sh", ["install"], { cwd: dir });
  step("./svc.sh", ["start"], { cwd: dir });
}

const runsOn = JSON.stringify(["self-hosted", ...labels.split(",")]);
console.log(
  `\n${dryRun ? "Dry run done" : `✓ Runner ${runnerName} registered`}.`
);
console.log(
  `Check it at https://github.com/${repo}/settings/actions/runners (status Idle).`
);
console.log("\nCI keeps using GitHub-hosted runners until you switch it:");
console.log(`  gh variable set CI_RUNS_ON --repo ${repo} --body '${runsOn}'`);
console.log("Switch back any time with:");
console.log(`  gh variable delete CI_RUNS_ON --repo ${repo}`);
