/** Shared helpers for the setup scripts. Node APIs only, run with `bun scripts/<name>.ts`. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { applyEdits, type JSONPath, modify, parse } from "jsonc-parser";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const WEB = join(ROOT, "apps/web");
export const WRANGLER_CONFIG = join(WEB, "wrangler.jsonc");
export const DEV_VARS = join(WEB, ".dev.vars");
export const DEV_VARS_EXAMPLE = join(WEB, ".dev.vars.example");

export const ENVIRONMENTS = ["develop", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function parseEnvironments(value: string | undefined): Environment[] {
  if (!value || value === "develop") return ["develop"];
  if (value === "all") return [...ENVIRONMENTS];
  if ((ENVIRONMENTS as readonly string[]).includes(value)) {
    return [value as Environment];
  }
  fail(`Unknown environment "${value}" (develop | staging | production | all)`);
}

/** `--env` flag for Wrangler: none for the top-level (develop) environment. */
export function envFlag(env: Environment): string[] {
  return env === "develop" ? [] : ["--env", env];
}

export interface RunResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the project's Wrangler in apps/web. With `dryRun`, prints the command instead. */
export function wrangler(
  args: readonly string[],
  options: { readonly dryRun?: boolean; readonly input?: string } = {}
): RunResult {
  const printable = `wrangler ${args.join(" ")}`;
  if (options.dryRun) {
    console.log(`  (dry run) ${printable}`);
    return { ok: true, stdout: "", stderr: "" };
  }
  const result = spawnSync("bunx", ["wrangler", ...args], {
    cwd: WEB,
    input: options.input,
    encoding: "utf8",
    stdio: [options.input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** wrangler.jsonc as data, comments ignored. */
export function readWranglerConfig(): Record<string, unknown> {
  return parse(readFileSync(WRANGLER_CONFIG, "utf8")) as Record<
    string,
    unknown
  >;
}

/** The config block of an environment (top level for develop). */
export function envBlock(
  config: Record<string, unknown>,
  env: Environment
): Record<string, unknown> {
  if (env === "develop") return config;
  const block = (config.env as Record<string, unknown> | undefined)?.[env];
  if (!block) fail(`wrangler.jsonc has no env.${env}`);
  return block as Record<string, unknown>;
}

export function envPath(env: Environment, ...path: JSONPath): JSONPath {
  return env === "develop" ? path : ["env", env, ...path];
}

/** Sets a value in wrangler.jsonc, keeping comments and formatting. */
export function setWranglerValue(
  path: JSONPath,
  value: unknown,
  dryRun = false
): void {
  if (dryRun) {
    console.log(
      `  (dry run) wrangler.jsonc ${path.join(".")} = ${JSON.stringify(value)}`
    );
    return;
  }
  const text = readFileSync(WRANGLER_CONFIG, "utf8");
  const edits = modify(text, path, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  writeFileSync(WRANGLER_CONFIG, applyEdits(text, edits));
}

/** KEY=VALUE lines of a .dev.vars file. */
export function readDevVars(path = DEV_VARS): Map<string, string> {
  const vars = new Map<string, string>();
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) vars.set(match[1] as string, match[2] as string);
  }
  return vars;
}

/** Replaces or appends KEY=VALUE lines in .dev.vars, leaving comments alone. */
export function writeDevVars(values: Record<string, string>): void {
  const lines = existsSync(DEV_VARS)
    ? readFileSync(DEV_VARS, "utf8").split("\n")
    : readFileSync(DEV_VARS_EXAMPLE, "utf8").split("\n");
  const pending = new Map(Object.entries(values));
  const next = lines.map((line) => {
    const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key) as string;
      pending.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  for (const [key, value] of pending) next.push(`${key}=${value}`);
  writeFileSync(DEV_VARS, next.join("\n"), { mode: 0o600 });
}

/** Asks a question; `hidden` keeps the answer off the screen (secrets). */
export async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) {
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    output._writeToOutput = (text: string) => {
      if (text.includes(question)) process.stdout.write(text);
    };
  }
  const answer = await new Promise<string>((resolve) =>
    rl.question(question, resolve)
  );
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer.trim();
}
