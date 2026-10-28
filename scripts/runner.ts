/**
 * Self-hosted GitHub Actions runners in Docker on this machine, one container per worker.
 *
 *   bun run runner:up -- --workers <n> [--repo owner/name] [--labels a,b] [--dry-run]
 *   bun run runner:down [-- --dry-run]
 *   bun run runner:logs [-- --worker <n> ...]
 *   bun run runner:remove -- (--worker <n> ... | --all) [--repo owner/name] [--dry-run]
 *
 * `up` builds ops/runner/Dockerfile, registers each worker whose volume holds no registration
 * yet (one short-lived registration token from the signed-in `gh`, passed only in the
 * environment of a throwaway container, never printed), starts workers 1..n and stops any
 * worker above n (it stays registered: `remove` unregisters it). `down` stops every worker,
 * `remove` unregisters workers in GitHub and deletes their containers and volumes.
 *
 * CI only uses the runners once the CI_RUNS_ON repository variable points at them; pull
 * requests from forks always stay on GitHub-hosted runners. Guide:
 * docs/guides/how-to-setup-ci.md#self-hosted-runners.
 */
import { type SpawnSyncOptions, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { fail, ROOT } from "./lib";
import {
  bunVersion,
  composeEnv,
  defaultLabels,
  dockerfileArgs,
  dockerPrefix,
  imageName,
  type Options,
  parseOptions,
  planUp,
  projectName,
  removeTargets,
  repoFromRemote,
  runnerName,
  runsOnValue,
  UsageError,
  type WorkerState,
  workerFromName,
} from "./runner-plan";

const RUNNER_DIR = join(ROOT, "ops/runner");

let options: Options;
try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError || error instanceof TypeError) {
    fail(
      `${error.message}\nUsage: see the comment at the top of scripts/runner.ts`
    );
  }
  throw error;
}
const { dryRun } = options;
const host = hostname();

interface Captured {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a read-only query and captures its output (also in a dry run). */
function capture(command: string, args: readonly string[]): Captured {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

/** Runs a command with the terminal attached; a dry run only prints it. */
function step(
  command: string,
  args: readonly string[],
  extra: SpawnSyncOptions = {}
): void {
  const shown = `${command} ${args.join(" ")}`;
  if (dryRun) {
    console.log(`  (dry run) ${shown}`);
    return;
  }
  console.log(`  $ ${shown}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...extra,
  });
  if (result.status !== 0) fail(`${command} failed (exit ${result.status})`);
}

/** `docker compose` for one worker, with the variables the compose file needs. */
function compose(
  repo: string,
  labels: readonly string[],
  worker: number,
  args: readonly string[],
  secretEnv: Record<string, string> = {}
): void {
  const env = composeEnv(repo, host, worker, labels);
  step(
    "docker",
    [
      "compose",
      "-f",
      "ops/runner/docker-compose.yml",
      "-p",
      projectName(repo, worker),
      ...args,
    ],
    { env: { ...process.env, ...env, ...secretEnv } }
  );
}

function resolveRepo(): string {
  if (options.repo) return options.repo;
  const origin = capture("git", ["remote", "get-url", "origin"]);
  if (!origin.ok) fail("No origin remote; pass --repo owner/name");
  const repo = repoFromRemote(origin.stdout);
  if (!repo) fail(`origin (${origin.stdout}) is not a GitHub URL; pass --repo`);
  return repo;
}

/** Docker must run; in a dry run a missing Docker only means "no workers yet". */
function dockerAvailable(): boolean {
  if (capture("docker", ["info", "--format", "{{.ServerVersion}}"]).ok)
    return true;
  if (dryRun) {
    console.log("  Docker is not running: assuming no workers exist yet.\n");
    return false;
  }
  fail("Docker is not running: start Docker Desktop (or the Docker daemon)");
}

/** The workers of this repository on this machine, from their volumes and containers. */
function existingWorkers(repo: string, docker: boolean): WorkerState[] {
  if (!docker) return [];
  const prefix = dockerPrefix(repo);
  const image = imageName(repo);
  const imageExists = capture("docker", ["image", "inspect", image]).ok;

  const running = new Set<number>();
  const containers = capture("docker", [
    "ps",
    "--filter",
    `label=ci-runner.repo=${repo}`,
    "--format",
    "{{.Names}}",
  ]);
  for (const name of containers.stdout.split("\n")) {
    const worker = workerFromName(prefix, name);
    if (worker !== undefined) running.add(worker);
  }

  const volumes = capture("docker", ["volume", "ls", "--format", "{{.Name}}"]);
  const workers = new Set(running);
  for (const name of volumes.stdout.split("\n")) {
    if (!name.endsWith("-state")) continue;
    const worker = workerFromName(prefix, name);
    if (worker !== undefined) workers.add(worker);
  }

  return [...workers]
    .sort((a, b) => a - b)
    .map((worker) => {
      const volume = `${projectName(repo, worker)}-state`;
      // Without the image (dry run before the first build) the volume's presence is all
      // we can see; `register` is a no-op for a registered worker anyway.
      const registered = imageExists
        ? capture("docker", [
            "run",
            "--rm",
            "--entrypoint",
            "test",
            "-v",
            `${volume}:/runner-state`,
            image,
            "-f",
            "/runner-state/.runner",
          ]).ok
        : capture("docker", ["volume", "inspect", volume]).ok;
      return { worker, registered, running: running.has(worker) };
    });
}

/** Fails when the image's pinned versions no longer match the repository. */
function checkImageVersions(): void {
  const args = dockerfileArgs(
    readFileSync(join(RUNNER_DIR, "Dockerfile"), "utf8")
  );
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    packageManager: string;
  };
  const web = JSON.parse(
    readFileSync(join(ROOT, "apps/web/package.json"), "utf8")
  ) as { devDependencies: Record<string, string> };
  const expected: Record<string, string | undefined> = {
    BUN_VERSION: bunVersion(pkg.packageManager),
    NODE_VERSION: readFileSync(join(ROOT, ".nvmrc"), "utf8").trim(),
    PLAYWRIGHT_VERSION: web.devDependencies["@playwright/test"],
  };
  const stale = Object.entries(expected).filter(
    ([arg, version]) => args.get(arg) !== version
  );
  if (stale.length > 0) {
    fail(
      [
        "ops/runner/Dockerfile is out of date:",
        ...stale.map(
          ([arg, version]) =>
            `  ARG ${arg}=${args.get(arg)}, the repository uses ${version}`
        ),
        "Update the ARG and, for Bun and Node, its SHA-256 lines (docs/processes/dependencies.md).",
      ].join("\n")
    );
  }
}

function ghToken(repo: string, kind: "registration"): string {
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

function requireGh(repo: string): { isPrivate: boolean } {
  if (!capture("sh", ["-c", "command -v gh"]).ok) {
    fail("The GitHub CLI (gh) is needed: https://cli.github.com");
  }
  if (!capture("gh", ["auth", "status"]).ok) {
    fail("gh is not signed in: run `gh auth login`");
  }
  const info = capture("gh", [
    "api",
    `repos/${repo}`,
    "--jq",
    "{private: .private, admin: .permissions.admin}",
  ]);
  if (!info.ok) fail(`Cannot read ${repo}: ${info.stderr}`);
  const { private: isPrivate, admin } = JSON.parse(info.stdout) as {
    private: boolean;
    admin: boolean;
  };
  if (!admin) fail(`You need admin access to ${repo} to manage its runners.`);
  return { isPrivate };
}

const SECURITY_NOTE = [
  "A runner runs whatever code a job checks out. In a PUBLIC repository this is only safe",
  "because CI sends pull requests from forks to GitHub-hosted runners, no workflow uses",
  "pull_request_target, deploys start only by hand, and outside contributors' workflows need",
  "approval (Settings → Actions → General). See docs/guides/how-to-setup-ci.md#security.",
].join("\n");

// --- Commands ------------------------------------------------------------------------

function up(): void {
  const repo = resolveRepo();
  const workers = options.workers as number;
  const labels = options.labels ?? defaultLabels(repo);
  checkImageVersions();

  console.log(`Self-hosted runners for ${repo}`);
  console.log(`  workers: ${workers}`);
  console.log(
    `  names:   ${runnerName(host, repo, 1)}${workers > 1 ? ` … ${runnerName(host, repo, workers)}` : ""}`
  );
  console.log(
    `  labels:  self-hosted, ${labels.join(", ")} (plus Linux and the architecture)`
  );
  console.log(`  image:   ${imageName(repo)} (ops/runner/Dockerfile)`);
  if (dryRun)
    console.log("  Dry run: nothing is built, registered or started.");
  console.log("");

  const docker = dockerAvailable();
  console.log("Build the image");
  step("docker", ["build", "--tag", imageName(repo), "ops/runner"]);

  const plan = planUp(workers, existingWorkers(repo, docker));
  console.log("\nPlan");
  console.log(
    `  register: ${plan.register.length > 0 ? plan.register.join(", ") : "none (all registered)"}`
  );
  console.log(`  start:    ${plan.start.join(", ")}`);
  console.log(
    `  stop:     ${plan.stop.length > 0 ? plan.stop.join(", ") : "none"}`
  );

  if (plan.register.length > 0) {
    console.log("\nRegister");
    let token = "<registration token>";
    if (dryRun) {
      console.log(
        `  (dry run) gh api -X POST repos/${repo}/actions/runners/registration-token --jq .token  (not printed)`
      );
    } else {
      const { isPrivate } = requireGh(repo);
      if (!isPrivate) console.log(`\n${SECURITY_NOTE}\n`);
      token = ghToken(repo, "registration");
    }
    for (const worker of plan.register) {
      // `-e RUNNER_TOKEN` without a value passes it from this process's environment, so it
      // never appears in a command line; the throwaway container is removed afterwards.
      compose(
        repo,
        labels,
        worker,
        [
          "run",
          "--rm",
          "--no-deps",
          "-T",
          "-e",
          "RUNNER_TOKEN",
          "runner",
          "register",
        ],
        { RUNNER_TOKEN: token }
      );
    }
  }

  console.log("\nStart");
  for (const worker of plan.start) {
    compose(repo, labels, worker, ["up", "--detach", "--wait"]);
  }

  if (plan.stop.length > 0) {
    console.log("\nStop the workers above the wanted count");
    for (const worker of plan.stop) compose(repo, labels, worker, ["stop"]);
  }
  if (plan.idleRegistered.length > 0) {
    const list = plan.idleRegistered.map((n) => `--worker ${n}`).join(" ");
    console.log(
      `\nStopped but still registered (offline in GitHub): worker ${plan.idleRegistered.join(", ")}.`
    );
    console.log(
      `A higher --workers starts them again. To unregister: bun run runner:remove -- ${list}`
    );
  }

  console.log(
    `\n${dryRun ? "Dry run done" : "Runners started"}. Check them at https://github.com/${repo}/settings/actions/runners (status Idle).`
  );
  console.log("CI keeps using GitHub-hosted runners until you switch it:");
  console.log(
    `  gh variable set CI_RUNS_ON --repo ${repo} --body '${runsOnValue(labels)}'`
  );
  console.log(
    `Back to GitHub-hosted: gh variable delete CI_RUNS_ON --repo ${repo}`
  );
}

function down(): void {
  const repo = resolveRepo();
  const running = existingWorkers(repo, dockerAvailable()).filter(
    (state) => state.running
  );
  if (running.length === 0) {
    console.log(`No running workers for ${repo}.`);
    return;
  }
  const labels = defaultLabels(repo);
  for (const { worker } of running) compose(repo, labels, worker, ["stop"]);
  console.log(
    `\n${dryRun ? "Dry run done" : "Workers stopped"}; they keep their registration. Jobs queue until \`bun run runner:up\`.`
  );
  console.log(
    `If CI_RUNS_ON points at them and they stay off, switch back: gh variable delete CI_RUNS_ON --repo ${repo}`
  );
}

function logs(): void {
  const repo = resolveRepo();
  dockerAvailable();
  const workers =
    options.worker.length > 0
      ? options.worker
      : existingWorkers(repo, true).map((state) => state.worker);
  if (workers.length === 0)
    fail(`No workers for ${repo}; start them with runner:up`);
  for (const worker of workers) {
    const name = projectName(repo, worker);
    const child = spawn("docker", ["logs", "--follow", "--tail", "50", name], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on("line", (line) =>
        console.log(`[worker ${worker}] ${line}`)
      );
    }
  }
}

function remove(): void {
  const repo = resolveRepo();
  const docker = dockerAvailable();
  const targets = removeTargets(options, existingWorkers(repo, docker));
  if (targets.length === 0) {
    console.log(`No workers for ${repo} on this machine.`);
    return;
  }
  if (!dryRun) requireGh(repo);
  const labels = defaultLabels(repo);

  for (const worker of targets) {
    const name = runnerName(host, repo, worker);
    console.log(`\nWorker ${worker} (${name})`);
    // Stop first: GitHub refuses to delete a runner that is running a job.
    compose(repo, labels, worker, ["stop"]);

    const lookup = `repos/${repo}/actions/runners`;
    const jq = `.runners[] | select(.name == "${name}") | .id`;
    if (dryRun) {
      console.log(`  (dry run) gh api --paginate ${lookup} --jq '${jq}'`);
      console.log(`  (dry run) gh api -X DELETE ${lookup}/<id>`);
    } else {
      const found = capture("gh", ["api", "--paginate", lookup, "--jq", jq]);
      if (!found.ok)
        fail(`Cannot list the runners of ${repo}: ${found.stderr}`);
      if (found.stdout) {
        step("gh", ["api", "-X", "DELETE", `${lookup}/${found.stdout}`]);
      } else {
        console.log(`  ${name} is not registered in GitHub (already removed).`);
      }
    }
    compose(repo, labels, worker, ["down", "--volumes"]);
  }
  console.log(
    `\n${dryRun ? "Dry run done" : "Removed"}. If CI_RUNS_ON still points at self-hosted runners and none is left, jobs queue forever:`
  );
  console.log(`  gh variable delete CI_RUNS_ON --repo ${repo}`);
}

const commands = { up, down, logs, remove } as const;
commands[options.command]();
