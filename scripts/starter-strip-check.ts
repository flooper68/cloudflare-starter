/**
 * `bun scripts/starter-strip-check.ts [--only <ids> | --each | --all] [--keep <ids>]
 * [--dir <path>] [--commands "<cmd>;<cmd>"] [--no-install]`
 *
 * Proves a strip leaves a working app: copies the repository (tracked and untracked
 * files, no node_modules) to a scratch directory, installs, runs `starter:strip --apply
 * --yes` there, runs it a second time (it must find nothing to do), then the commands
 * (default: the migrations match the schema and apply to a fresh local D1, then typecheck,
 * lint and test). Without a selection it strips the default set, which
 * CI does on every pull request (job `starter-strip`). --each checks every active
 * component on its own; --all strips everything active at once.
 * docs/processes/development.md#starter-only-parts
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { ROOT } from "./lib";
import { readManifest } from "./starter-strip-lib";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    keep: { type: "string" },
    each: { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    dir: { type: "string" },
    commands: { type: "string" },
    "no-install": { type: "boolean", default: false },
    "keep-copy": { type: "boolean", default: false },
  },
});

/**
 * After the strip: the regenerated migrations match the schema (generating again changes
 * nothing) and apply to a fresh local D1, then the app typechecks, lints and tests.
 */
const DEFAULT_COMMANDS = [
  "cd packages/features && bunx drizzle-kit generate | grep -q 'No schema changes'",
  "cp apps/web/.dev.vars.example apps/web/.dev.vars && bun run db:migrate:local",
  "bun run typecheck",
  "bun run lint",
  "bun run test",
].join(";");

const commands = (values.commands ?? DEFAULT_COMMANDS)
  .split(";")
  .map((command) => command.trim())
  .filter(Boolean);

const active = readManifest(ROOT)
  .components.filter((component) => component.status === "active")
  .map((component) => component.id);

const runs: { label: string; args: string[] }[] = values.each
  ? active.map((id) => ({ label: id, args: ["--only", id] }))
  : values.all
    ? [{ label: "all", args: ["--only", active.join(",")] }]
    : [
        {
          label: values.only ?? "default",
          args: [
            ...(values.only ? ["--only", values.only] : []),
            ...(values.keep ? ["--keep", values.keep] : []),
          ],
        },
      ];

/** A project's own name and repository, as an owner passes them. */
const PARAMS = [
  "--name",
  "Acme App",
  "--repo-url",
  "https://github.com/acme/acme-app",
];

const failures: string[] = [];
for (const run of runs) {
  console.log(`\n=== starter:strip ${run.label} ===`);
  const parent = values.dir ? resolve(values.dir) : tmpdir();
  mkdirSync(parent, { recursive: true });
  const copy = mkdtempSync(join(parent, "starter-strip-"));
  try {
    copyRepository(copy);
    const args = [...PARAMS, ...run.args];
    const steps: string[][] = [
      ...(values["no-install"]
        ? []
        : [["bun", "install", "--frozen-lockfile"]]),
      [
        "bun",
        "scripts/starter-strip.ts",
        "--apply",
        "--yes",
        "--skip-checks",
        ...args,
      ],
      ["bun", "install"],
      ["bun", "run", "lint:fix"],
    ];
    let ok = steps.every((step) => sh(copy, step));
    if (ok) ok = idempotent(copy, args);
    if (ok) ok = commands.every((command) => sh(copy, ["sh", "-c", command]));
    if (!ok) failures.push(run.label);
  } finally {
    if (!values["keep-copy"]) rmSync(copy, { recursive: true, force: true });
    else console.log(`(kept ${copy})`);
  }
}

if (failures.length) {
  console.error(`\nStrip broke the app: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`\n✓ ${runs.map((run) => run.label).join(", ")}`);

/** A second run must have nothing left to change. */
function idempotent(copy: string, args: string[]): boolean {
  const result = spawnSync(
    "bun",
    ["scripts/starter-strip.ts", "--yes", ...args],
    { cwd: copy, encoding: "utf8" }
  );
  const ok = result.status === 0 && /^0 change\(s\)\./m.test(result.stdout);
  if (!ok) {
    console.error(
      `Not idempotent: a second run still plans changes:\n${result.stdout}${result.stderr}`
    );
  }
  return ok;
}

function sh(cwd: string, command: string[]): boolean {
  console.log(`\n$ ${command.join(" ")}`);
  const result = spawnSync(command[0] as string, command.slice(1), {
    cwd,
    stdio: "inherit",
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(cwd) },
  });
  return result.status === 0;
}

/** Tracked and untracked (not ignored) files, as they are in the working tree. */
function copyRepository(target: string) {
  const listed = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (listed.status !== 0) throw new Error(listed.stderr);
  for (const file of listed.stdout.split("\0").filter(Boolean)) {
    const from = join(ROOT, file);
    if (!existsSync(from)) continue; // deleted in the working tree, still tracked
    mkdirSync(dirname(join(target, file)), { recursive: true });
    cpSync(from, join(target, file));
  }
}
