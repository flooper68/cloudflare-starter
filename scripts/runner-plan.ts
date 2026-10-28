/**
 * Pure parts of `scripts/runner.ts` (the Docker self-hosted runners): argument parsing,
 * names, the repository from the git remote, and the plan of what `runner:up` does.
 * No I/O here, so it is unit-tested in runner-plan.test.ts.
 */
import { parseArgs } from "node:util";

export const COMMANDS = ["up", "down", "logs", "remove"] as const;
export type Command = (typeof COMMANDS)[number];

/** GitHub refuses runner names longer than this. */
const MAX_RUNNER_NAME = 64;
const MAX_WORKERS = 16;

export interface Options {
  readonly command: Command;
  /** owner/name; undefined means "from the git remote". */
  readonly repo: string | undefined;
  /** runner:up: how many workers should run. */
  readonly workers: number | undefined;
  /** Custom labels; undefined means "the repository name". */
  readonly labels: readonly string[] | undefined;
  /** runner:logs and runner:remove: the workers to act on. */
  readonly worker: readonly number[];
  /** runner:remove: every worker of this repository on this machine. */
  readonly all: boolean;
  readonly dryRun: boolean;
}

export class UsageError extends Error {}

function positiveInt(value: string, flag: string, max: number): number {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new UsageError(`${flag} must be a whole number from 1 to ${max}`);
  }
  return Number(value);
}

/** Labels from "a,b": trimmed, without duplicates; each must be a valid runner label. */
export function parseLabels(value: string): string[] {
  const labels = [
    ...new Set(
      value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    ),
  ];
  if (labels.length === 0)
    throw new UsageError("--labels needs at least one label");
  const bad = labels.find((label) => !/^[\w.-]+$/.test(label));
  if (bad)
    throw new UsageError(`invalid label "${bad}" (letters, digits, . _ -)`);
  if (labels.includes("self-hosted")) {
    throw new UsageError(
      "--labels: self-hosted is added by GitHub; list only your own labels"
    );
  }
  return labels;
}

export function isRepo(value: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(value);
}

/** `<command> [flags]` as passed by the package.json scripts. */
export function parseOptions(argv: readonly string[]): Options {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      workers: { type: "string" },
      repo: { type: "string" },
      labels: { type: "string" },
      worker: { type: "string", multiple: true },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const command = positionals[0];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    throw new UsageError(`command must be one of: ${COMMANDS.join(", ")}`);
  }
  if (positionals.length > 1) {
    throw new UsageError(`unexpected argument "${positionals[1]}"`);
  }
  if (values.repo !== undefined && !isRepo(values.repo)) {
    throw new UsageError(`--repo must be owner/name: ${values.repo}`);
  }
  const workers =
    values.workers === undefined
      ? undefined
      : positiveInt(values.workers, "--workers", MAX_WORKERS);
  const worker = (values.worker ?? []).map((value) =>
    positiveInt(value, "--worker", MAX_WORKERS)
  );
  const options: Options = {
    command: command as Command,
    repo: values.repo,
    workers,
    labels:
      values.labels === undefined ? undefined : parseLabels(values.labels),
    worker: [...new Set(worker)].sort((a, b) => a - b),
    all: values.all ?? false,
    dryRun: values["dry-run"] ?? false,
  };

  const misplaced = (flag: string, set: boolean, allowed: Command[]): void => {
    if (set && !allowed.includes(options.command)) {
      throw new UsageError(`${flag} does not apply to runner:${command}`);
    }
  };
  misplaced("--workers", workers !== undefined, ["up"]);
  misplaced("--labels", values.labels !== undefined, ["up"]);
  misplaced("--worker", worker.length > 0, ["logs", "remove"]);
  misplaced("--all", options.all, ["remove"]);
  if (options.command === "up" && workers === undefined) {
    throw new UsageError("runner:up needs --workers <n>");
  }
  if (options.command === "remove") {
    if (options.all === options.worker.length > 0) {
      throw new UsageError("runner:remove needs either --worker <n> or --all");
    }
  }
  return options;
}

/** owner/name from an origin URL: git@github.com:o/n.git or https://github.com/o/n(.git). */
export function repoFromRemote(url: string): string | undefined {
  const match = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(
    url.trim()
  );
  return match?.[1];
}

/** Lowercase letters, digits and dashes: valid for Docker names and runner names. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The repository-wide prefix of the Docker names: `<owner>-<name>-runner`. */
export function dockerPrefix(repo: string): string {
  return `${slug(repo.replace("/", "-"))}-runner`;
}

/** Compose project, container name and (with -state) volume name of one worker. */
export function projectName(repo: string, worker: number): string {
  return `${dockerPrefix(repo)}-${worker}`;
}

export function imageName(repo: string): string {
  return `${dockerPrefix(repo)}:local`;
}

/**
 * The runner's name in GitHub: `<host>-<repo name>-<n>`, unique per machine and worker.
 * The host part is shortened when the whole would exceed GitHub's limit.
 */
export function runnerName(host: string, repo: string, worker: number): string {
  const short = slug(host.split(".")[0] ?? host) || "host";
  const suffix = `-${slug(repo.split("/")[1] ?? repo)}-${worker}`;
  return `${short.slice(0, Math.max(1, MAX_RUNNER_NAME - suffix.length))}${suffix}`;
}

/** The repository name: the default (and usually only) custom label. */
export function defaultLabels(repo: string): string[] {
  return [repo.split("/")[1] ?? repo];
}

/** The variables ops/runner/docker-compose.yml needs for one worker. */
export function composeEnv(
  repo: string,
  host: string,
  worker: number,
  labels: readonly string[]
): Record<string, string> {
  return {
    RUNNER_IMAGE: imageName(repo),
    RUNNER_PROJECT: projectName(repo, worker),
    RUNNER_NAME: runnerName(host, repo, worker),
    RUNNER_URL: `https://github.com/${repo}`,
    RUNNER_LABELS: labels.join(","),
    RUNNER_REPO: repo,
    RUNNER_WORKER: String(worker),
  };
}

/** The `CI_RUNS_ON` value that sends jobs to runners with these labels. */
export function runsOnValue(labels: readonly string[]): string {
  return JSON.stringify(["self-hosted", ...labels]);
}

/** What exists on this machine for one worker. */
export interface WorkerState {
  readonly worker: number;
  /** Its volume holds a registration. */
  readonly registered: boolean;
  /** Its container is running. */
  readonly running: boolean;
}

export interface UpPlan {
  /** Workers to register first (one registration token covers them all). */
  readonly register: readonly number[];
  /** Workers to start (or keep running); `docker compose up -d` is idempotent. */
  readonly start: readonly number[];
  /** Running workers above the wanted count: stopped, registration kept. */
  readonly stop: readonly number[];
  /** Registered workers above the wanted count, after the stops: offline in GitHub. */
  readonly idleRegistered: readonly number[];
}

export function planUp(
  workers: number,
  existing: readonly WorkerState[]
): UpPlan {
  const byWorker = new Map(existing.map((state) => [state.worker, state]));
  const wanted = Array.from({ length: workers }, (_, i) => i + 1);
  const extra = existing
    .filter((state) => state.worker > workers)
    .sort((a, b) => a.worker - b.worker);
  return {
    register: wanted.filter((n) => !byWorker.get(n)?.registered),
    start: wanted,
    stop: extra.filter((state) => state.running).map((state) => state.worker),
    idleRegistered: extra
      .filter((state) => state.registered)
      .map((state) => state.worker),
  };
}

/** Workers that runner:remove acts on. */
export function removeTargets(
  options: Pick<Options, "all" | "worker">,
  existing: readonly WorkerState[]
): number[] {
  if (options.all)
    return existing.map((state) => state.worker).sort((a, b) => a - b);
  return [...options.worker];
}

/**
 * Worker numbers from Docker names: volumes `<prefix>-<n>-state` and containers
 * `<prefix>-<n>`. Names of other repositories' workers are ignored.
 */
export function workerFromName(
  prefix: string,
  name: string
): number | undefined {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}-(\\d+)(?:-state)?$`).exec(name.trim());
  return match ? Number(match[1]) : undefined;
}

export interface Registration {
  /** The runner's id in GitHub (`repos/<repo>/actions/runners/<id>`). */
  readonly id: number;
  readonly name: string;
}

/**
 * The registration saved in a worker's volume: the runner's `.runner` file (JSON, sometimes
 * with a byte-order mark). It names the runner as registered, even if the hostname changed.
 */
export function parseRegistration(text: string): Registration | undefined {
  try {
    const data = JSON.parse(text.replace(/^﻿/, "")) as {
      agentId?: unknown;
      agentName?: unknown;
    };
    return typeof data.agentId === "number" &&
      typeof data.agentName === "string"
      ? { id: data.agentId, name: data.agentName }
      : undefined;
  } catch {
    return undefined;
  }
}

/** `bun@1.3.14` → `1.3.14`. */
export function bunVersion(packageManager: string): string | undefined {
  return /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager.trim())?.[1];
}

/** `ARG NAME=value` defaults of a Dockerfile. */
export function dockerfileArgs(dockerfile: string): Map<string, string> {
  const args = new Map<string, string>();
  for (const match of dockerfile.matchAll(/^ARG ([A-Z0-9_]+)=(\S+)$/gm)) {
    args.set(match[1] as string, match[2] as string);
  }
  return args;
}
