/**
 * The engine of `bun run starter:strip` (scripts/starter-strip.ts): reads the manifest of
 * the starter's own parts (starter-only.json), plans what stripping a component changes,
 * and applies it. Every operation is idempotent: applied again, it finds nothing to do.
 * Paths are relative to `root`, so the same code strips the repository or a scratch copy
 * (scripts/starter-strip-check.ts). docs/guides/how-to-start-a-project.md
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import GithubSlugger from "github-slugger";
import {
  findNodeAtLocation,
  type JSONPath,
  type Node,
  parse,
  parseTree,
} from "jsonc-parser";

import { ENVIRONMENTS, type Environment, modifyJsonc } from "./lib";

export const MANIFEST = "starter-only.json";
export const WRANGLER = "apps/web/wrangler.jsonc";

/** active: on main and strippable; pending: its PR is not merged; stripped: done here. */
export type ComponentStatus = "active" | "pending" | "stripped";

/** A value in wrangler.jsonc, per environment (develop is the top level). */
export interface WranglerEdit {
  readonly env: Environment | "all";
  readonly path: readonly (string | number)[];
  /** Set this value; without it the setting is removed. */
  readonly value?: unknown;
  /**
   * The `//` comment lines right above the setting: null removes them, a string replaces
   * them. Omitted, they stay. Only for a setting that starts its own line.
   */
  readonly comment?: string | null;
  /** Another JSONC file than apps/web/wrangler.jsonc. */
  readonly file?: string;
}

/** A value in a JSON file such as a package.json; without `value` it is removed. */
export interface JsonEdit {
  readonly file: string;
  readonly path: readonly (string | number)[];
  readonly value?: unknown;
}

/** A secret the owner deletes by hand (the strip never contacts Cloudflare or GitHub). */
export interface SecretRef {
  readonly name: string;
  /** Where it lives: Worker environments, or "github" (a repository or environment secret). */
  readonly where: readonly string[];
  readonly note?: string;
}

/** A job or one step of a job in a GitHub Actions workflow. */
export interface CiRef {
  readonly workflow: string;
  readonly job: string;
  /** The step's `name:`; without it the whole job is removed. */
  readonly step?: string;
  readonly why?: string;
}

/**
 * A doc change. delete: the page; remove: a section (its heading line through the next
 * heading of the same or a higher level); replace: that section by `content`; rewrite:
 * a change the owner makes by hand (printed as a next step).
 */
export interface DocEdit {
  readonly file: string;
  readonly action: "delete" | "remove" | "replace" | "rewrite";
  /** The heading's text without the leading #s (remove, replace). */
  readonly heading?: string;
  /** Only the heading and the text before its first subheading. */
  readonly intro?: boolean;
  readonly content?: string;
  readonly note?: string;
}

/** A literal text replacement in a file; done once `find` no longer occurs. */
export interface TextEdit {
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  /**
   * Remove every line that contains `find`, comparing with runs of spaces collapsed: a
   * table row, whatever padding the formatter gives it. `replace` must be "".
   */
  readonly line?: boolean;
}

const collapse = (text: string) => text.replace(/ {2,}/g, " ");

/** Whether `text` still has what a text edit changes. */
export function hasText(text: string, edit: TextEdit): boolean {
  return edit.line
    ? text.split("\n").some((line) => collapse(line).includes(edit.find))
    : text.includes(edit.find);
}

/** Applies a text edit; unchanged once it is applied. */
export function applyText(text: string, edit: TextEdit): string {
  return edit.line
    ? text
        .split("\n")
        .filter((line) => !collapse(line).includes(edit.find))
        .join("\n")
    : text.split(edit.find).join(edit.replace);
}

/** A whole file written with `content` (a reset, such as the changelog's). */
export interface FileWrite {
  readonly file: string;
  readonly content: string;
}

export interface Component {
  readonly id: string;
  readonly title: string;
  /** Why the starter has it and a new project does not. */
  readonly why: string;
  readonly status: ComponentStatus;
  /** For pending: the pull request it waits for. */
  readonly pending?: string;
  /** Whether `starter:strip` strips it unless told otherwise. */
  readonly default: boolean;
  readonly delete?: readonly string[];
  readonly tests?: readonly string[];
  readonly patch?: string;
  readonly wrangler?: readonly WranglerEdit[];
  readonly rateLimits?: readonly string[];
  readonly json?: readonly JsonEdit[];
  readonly secrets?: readonly SecretRef[];
  readonly ci?: readonly CiRef[];
  readonly docs?: readonly DocEdit[];
  readonly text?: readonly TextEdit[];
  readonly files?: readonly FileWrite[];
  /** Steps the script cannot do, printed after the strip. */
  readonly manual?: readonly string[];
}

export interface Manifest {
  readonly components: readonly Component[];
}

/** Values the owner gives (`--name`, `--repo-url`), substituted for {{name}} and {{repoUrl}}. */
export interface Params {
  readonly name?: string;
  readonly repoUrl?: string;
}

/** One change the strip makes. `run` applies it; `done` means there is nothing to do. */
export interface Action {
  readonly component: string;
  readonly description: string;
  readonly done: boolean;
  readonly run: () => void;
  /** Patches run before every other change of every component (they need the original text). */
  readonly phase?: "patch";
}

/** The actions of several components in the order they run: every patch first. */
export function inRunOrder(actions: readonly Action[]): Action[] {
  return [
    ...actions.filter((action) => action.phase === "patch"),
    ...actions.filter((action) => action.phase !== "patch"),
  ];
}

export function readManifest(root: string): Manifest {
  return JSON.parse(readFileSync(join(root, MANIFEST), "utf8")) as Manifest;
}

/** Problems with the manifest's shape: ids, statuses, required fields. Empty when valid. */
export function validateManifest(manifest: Manifest): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const component of manifest.components) {
    const label = component.id || "(no id)";
    if (!/^[a-z][a-z0-9-]*$/.test(component.id ?? ""))
      problems.push(`${label}: id must be kebab-case`);
    if (ids.has(component.id)) problems.push(`${label}: duplicate id`);
    ids.add(component.id);
    if (!component.title) problems.push(`${label}: no title`);
    if (!component.why) problems.push(`${label}: no why`);
    if (!["active", "pending", "stripped"].includes(component.status))
      problems.push(`${label}: status must be active, pending or stripped`);
    if (component.status === "pending" && !component.pending)
      problems.push(`${label}: pending needs the PR it waits for`);
    if (typeof component.default !== "boolean")
      problems.push(`${label}: default must be true or false`);
    for (const edit of component.text ?? [])
      if (edit.replace.includes(edit.find))
        problems.push(
          `${label}: ${edit.file}: the replacement contains what it replaces, so the edit never finishes`
        );
    for (const doc of component.docs ?? []) {
      if ((doc.action === "remove" || doc.action === "replace") && !doc.heading)
        problems.push(`${label}: ${doc.file} ${doc.action} needs a heading`);
      if (doc.action === "replace" && doc.content === undefined)
        problems.push(`${label}: ${doc.file} replace needs content`);
    }
  }
  return problems;
}

/** The components a strip selects: the defaults, or `only`, minus `keep`. */
export function selectComponents(
  manifest: Manifest,
  options: {
    readonly only?: readonly string[];
    readonly keep?: readonly string[];
  }
): Component[] {
  const known = new Set(manifest.components.map((component) => component.id));
  for (const id of [...(options.only ?? []), ...(options.keep ?? [])])
    if (!known.has(id)) throw new Error(`Unknown component "${id}"`);
  const keep = new Set(options.keep ?? []);
  return manifest.components.filter((component) =>
    options.only?.length
      ? options.only.includes(component.id) && !keep.has(component.id)
      : component.default && !keep.has(component.id)
  );
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function substitute<T>(value: T, params: Params): T | undefined {
  let missing = false;
  const walk = (item: unknown): unknown => {
    if (typeof item === "string")
      return item.replace(/\{\{(name|repoUrl)\}\}/g, (_, key: keyof Params) => {
        const given = params[key];
        if (!given) missing = true;
        return given ?? "";
      });
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item).map(([key, inner]) => [key, walk(inner)])
      );
    return item;
  };
  const result = walk(value) as T;
  return missing ? undefined : result;
}

function readText(root: string, file: string): string | null {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function lineStart(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}

/**
 * The `//` comment lines directly above the line at `offset`, as [start, end) offsets
 * (end is the start of that line), or null when there are none or the setting does not
 * start its line.
 */
function commentAbove(
  text: string,
  offset: number
): { start: number; end: number; indent: string } | null {
  const start = lineStart(text, offset);
  const indent = text.slice(start, offset);
  if (indent.trim() !== "") return null;
  let cursor = start;
  while (cursor > 0) {
    const previous = lineStart(text, cursor - 1);
    if (
      !text
        .slice(previous, cursor - 1)
        .trim()
        .startsWith("//")
    )
      break;
    cursor = previous;
  }
  return { start: cursor, end: start, indent };
}

function propertyNode(tree: Node | undefined, path: JSONPath): Node | null {
  if (!tree) return null;
  const node = findNodeAtLocation(tree, path);
  if (!node) return null;
  return node.parent?.type === "property" ? node.parent : node;
}

/**
 * Applies one edit to JSONC text with jsonc-parser (as setWranglerValue does), keeping
 * every other comment; `comment` handles the lines right above the setting. Returns the
 * text unchanged when the edit is already in place.
 */
export function editJsonc(
  text: string,
  path: JSONPath,
  edit: { readonly value?: unknown; readonly comment?: string | null }
): string {
  const remove = !("value" in edit) || edit.value === undefined;
  const tree = parseTree(text);
  const existing = tree ? findNodeAtLocation(tree, path) : undefined;
  if (remove && !existing) return text;
  const current = parse(text) as unknown;
  const now = path.reduce<unknown>(
    (value, key) =>
      value && typeof value === "object"
        ? (value as Record<string | number, unknown>)[key]
        : undefined,
    current
  );
  const node = propertyNode(tree, path);
  const above = node ? commentAbove(text, node.offset) : null;
  const wanted =
    edit.comment === undefined || !above
      ? null
      : edit.comment === null
        ? ""
        : edit.comment
            .split("\n")
            .map((line) => `${above.indent}// ${line}`.trimEnd())
            .join("\n")
            .concat("\n");
  const commentChanges =
    wanted !== null && text.slice(above?.start, above?.end) !== wanted;
  if (
    !remove &&
    JSON.stringify(now) === JSON.stringify(edit.value) &&
    !commentChanges
  )
    return text;
  let next = text;
  if (above && wanted !== null && (commentChanges || remove)) {
    next = next.slice(0, above.start) + wanted + next.slice(above.end);
  }
  return modifyJsonc(next, path, remove ? undefined : edit.value);
}

/** The index of the ratelimits binding `name` in an environment, or -1. */
function rateLimitIndex(
  config: Record<string, unknown>,
  env: Environment,
  name: string
): number {
  const block =
    env === "develop"
      ? config
      : ((config.env as Record<string, Record<string, unknown>> | undefined)?.[
          env
        ] ?? {});
  const limits = (block.ratelimits as { name: string }[] | undefined) ?? [];
  return limits.findIndex((binding) => binding.name === name);
}

export function envJsonPath(
  env: Environment,
  path: readonly (string | number)[]
) {
  return env === "develop" ? [...path] : ["env", env, ...path];
}

/** The environments a wrangler.jsonc defines (develop is always there). */
export function definedEnvironments(text: string): Environment[] {
  const config = parse(text) as { env?: Record<string, unknown> };
  return ENVIRONMENTS.filter(
    (env) => env === "develop" || Boolean(config.env?.[env])
  );
}

/** Markdown headings outside fenced code: [line index, level, text]. */
function headings(lines: readonly string[]): [number, number, string][] {
  const found: [number, number, string][] = [];
  let fence: string | null = null;
  lines.forEach((line, index) => {
    const marker = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker[0] as string;
      else if (marker.startsWith(fence)) fence = null;
      return;
    }
    if (fence !== null) return;
    const match = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (match) found.push([index, match[1]?.length ?? 0, match[2] ?? ""]);
  });
  return found;
}

/** The [start, end) line range of the section under `heading`, or null. */
export function sectionRange(
  text: string,
  heading: string,
  intro = false
): [number, number] | null {
  const lines = text.split("\n");
  const all = headings(lines);
  const at = all.findIndex(([, , title]) => title === heading);
  if (at === -1) return null;
  const [start, level] = all[at] as [number, number, string];
  const next = all.slice(at + 1).find(([, other]) => intro || other <= level);
  return [start, next ? next[0] : lines.length];
}

/**
 * Removes or replaces a Markdown section (`intro`: only the text before its first
 * subheading); unchanged when it is already gone or replaced.
 */
export function editSection(
  text: string,
  heading: string,
  content?: string,
  intro = false
): string {
  const range = sectionRange(text, heading, intro);
  if (!range) return text;
  const current = text.split("\n").slice(range[0], range[1]).join("\n");
  if (content !== undefined && current.trimEnd() === content.trimEnd())
    return text;
  const lines = text.split("\n");
  const replacement =
    content === undefined ? [] : content.trimEnd().split("\n");
  if (replacement.length) replacement.push("");
  const before = lines.slice(0, range[0]);
  const after = lines.slice(range[1]);
  const next = [...before, ...replacement, ...after].join("\n");
  return next.replace(/\n{3,}/g, "\n\n");
}

/**
 * Blockquote notes `> **Starter-only, removed by `starter:strip`** (`<id>`) …`, also
 * indented inside a list item.
 */
export const STARTER_NOTE =
  /^\s*> \*\*Starter-only, removed by `starter:strip`\*\* \(`([a-z0-9-]+)`\)/;

/** Removes the starter-only notes of a component from Markdown. */
export function removeStarterNotes(text: string, id: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = STARTER_NOTE.exec(lines[index] ?? "");
    if (match && match[1] === id) {
      while (
        index + 1 < lines.length &&
        lines[index + 1]?.trimStart().startsWith(">")
      )
        index++;
      if (lines[index + 1]?.trim() === "" && kept.at(-1)?.trim() === "")
        index++;
      continue;
    }
    kept.push(lines[index] as string);
  }
  return kept.join("\n");
}

/** The [start, end) line range of a workflow job (with its comments above), or null. */
export function jobRange(text: string, job: string): [number, number] | null {
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`^  ${job.replace(/[-]/g, "\\-")}:\\s*$`).test(line)
  );
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^ {0,2}\S/.test(lines[end] ?? "")) end++;
  // Comment lines at the next job's indent belong to that job.
  while (end > start + 1 && /^\s*$/.test(lines[end - 1] ?? "")) end--;
  let first = start;
  while (first > 0 && /^ {2}#/.test(lines[first - 1] ?? "")) first--;
  return [first, end];
}

/** The [start, end) line range of the step `name` in `job` (with its comments), or null. */
export function stepRange(
  text: string,
  job: string,
  name: string
): [number, number] | null {
  const range = jobRange(text, job);
  if (!range) return null;
  const lines = text.split("\n");
  for (let index = range[0]; index < range[1]; index++) {
    const match = /^(\s*)- name: (.+?)\s*$/.exec(lines[index] ?? "");
    if (!match || match[2]?.replace(/^["']|["']$/g, "") !== name) continue;
    const indent = match[1]?.length ?? 0;
    let end = index + 1;
    while (end < range[1]) {
      const line = lines[end] ?? "";
      if (line.trim() !== "") {
        const lead = line.length - line.trimStart().length;
        if (lead <= indent) break;
      }
      end++;
    }
    while (end > index + 1 && /^\s*$/.test(lines[end - 1] ?? "")) end--;
    let first = index;
    while (
      first > range[0] &&
      new RegExp(`^ {${indent}}#`).test(lines[first - 1] ?? "")
    )
      first--;
    return [first, end];
  }
  return null;
}

function removeLines(text: string, range: [number, number]): string {
  const lines = text.split("\n");
  lines.splice(range[0], range[1] - range[0]);
  // No doubled blank line where the block was.
  if (lines[range[0] - 1]?.trim() === "" && lines[range[0]]?.trim() === "")
    lines.splice(range[0], 1);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

function gitApply(root: string, patch: string, ...flags: string[]) {
  return spawnSync("git", ["apply", "--whitespace=nowarn", ...flags, patch], {
    cwd: root,
    encoding: "utf8",
    // A scratch copy may sit inside another repository: never let git find it.
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(root) },
  });
}

/** applied, applicable, or the reason it applies neither way. */
export function patchState(
  root: string,
  patch: string
): "applied" | "applicable" | string {
  const path = join(root, patch);
  if (!existsSync(path)) return `${patch} does not exist`;
  if (gitApply(root, path, "--check", "--reverse").status === 0)
    return "applied";
  const forward = gitApply(root, path, "--check");
  if (forward.status === 0) return "applicable";
  return forward.stderr.trim() || "does not apply";
}

/** The files a patch changes. */
export function patchFiles(root: string, patch: string): string[] {
  const result = gitApply(root, join(root, patch), "--numstat");
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t")[2] ?? "");
}

function textAction(
  component: string,
  root: string,
  file: string,
  description: string,
  change: (text: string) => string
): Action {
  const text = readText(root, file);
  const next = text === null ? null : change(text);
  return {
    component,
    description,
    done: text === null || next === text,
    run: () => {
      const current = readText(root, file);
      if (current === null) return;
      writeFileSync(join(root, file), change(current));
    },
  };
}

/**
 * Everything stripping `component` changes, in order: the patch (it edits files that
 * stay), settings, CI, docs, then deletions. Manual steps and secrets are not actions;
 * they are printed (`nextSteps`).
 */
export function planComponent(
  root: string,
  component: Component,
  params: Params
): { actions: Action[]; skipped: string[] } {
  const id = component.id;
  const actions: Action[] = [];
  const skipped: string[] = [];

  if (component.patch) {
    const patch = component.patch;
    const state = patchState(root, patch);
    if (state !== "applied" && state !== "applicable")
      throw new Error(
        `${id}: ${patch} no longer applies (the code it edits changed): ${state}. Regenerate it (docs/processes/development.md#starter-only-parts).`
      );
    const files = patchFiles(root, patch);
    actions.push({
      component: id,
      description: `edit ${files.length} file(s) with ${patch}: ${files.join(", ")}`,
      done: state === "applied",
      phase: "patch",
      run: () => {
        const result = gitApply(root, join(root, patch));
        if (result.status !== 0)
          throw new Error(`${patch}: ${result.stderr.trim()}`);
      },
    });
  }

  for (const raw of component.wrangler ?? []) {
    const edit = substitute(raw, params);
    if (!edit) {
      skipped.push(
        `${raw.file ?? WRANGLER}: set ${raw.path.join(".")} (${raw.env}) by hand: ${JSON.stringify(raw.value)} needs --name or --repo-url`
      );
      continue;
    }
    const file = edit.file ?? WRANGLER;
    const text = readText(root, file);
    if (text === null) continue;
    const envs =
      edit.env === "all"
        ? edit.file
          ? (["develop"] as Environment[])
          : definedEnvironments(text)
        : [edit.env];
    for (const env of envs) {
      const path = envJsonPath(env, edit.path);
      const verb =
        edit.value === undefined
          ? "remove"
          : `set to ${JSON.stringify(edit.value)}`;
      actions.push(
        textAction(id, root, file, `${file} ${path.join(".")}: ${verb}`, (t) =>
          editJsonc(t, path, edit)
        )
      );
    }
  }

  for (const name of component.rateLimits ?? []) {
    const text = readText(root, WRANGLER);
    if (text === null) continue;
    for (const env of definedEnvironments(text)) {
      const remove = (t: string) => {
        const index = rateLimitIndex(
          parse(t) as Record<string, unknown>,
          env,
          name
        );
        return index === -1
          ? t
          : modifyJsonc(t, envJsonPath(env, ["ratelimits", index]), undefined);
      };
      actions.push(
        textAction(
          id,
          root,
          WRANGLER,
          `${WRANGLER} ${env}: remove the ${name} ratelimits binding`,
          remove
        )
      );
    }
  }

  for (const raw of component.json ?? []) {
    const edit = substitute(raw, params);
    if (!edit) {
      skipped.push(
        `${raw.file}: set ${raw.path.join(".")} by hand (needs --name or --repo-url)`
      );
      continue;
    }
    const verb =
      edit.value === undefined
        ? "remove"
        : `set to ${JSON.stringify(edit.value)}`;
    actions.push(
      textAction(
        id,
        root,
        edit.file,
        `${edit.file} ${edit.path.join(".")}: ${verb}`,
        (t) => editJsonc(t, [...edit.path], { value: edit.value })
      )
    );
  }

  for (const ref of component.ci ?? []) {
    const what = ref.step
      ? `step "${ref.step}" of job ${ref.job}`
      : `job ${ref.job}`;
    actions.push(
      textAction(
        id,
        root,
        ref.workflow,
        `${ref.workflow}: remove ${what}`,
        (t) => {
          const range = ref.step
            ? stepRange(t, ref.job, ref.step)
            : jobRange(t, ref.job);
          return range ? removeLines(t, range) : t;
        }
      )
    );
  }

  for (const raw of component.docs ?? []) {
    const doc = substitute(raw, params);
    if (!doc) {
      const text = readText(root, raw.file);
      if (text !== null && sectionRange(text, raw.heading ?? "", raw.intro))
        skipped.push(
          `${raw.file}: rewrite "${raw.heading}" by hand (needs --name or --repo-url)`
        );
      continue;
    }
    if (doc.action === "delete") {
      actions.push(deleteAction(id, root, doc.file));
    } else if (doc.action === "remove" || doc.action === "replace") {
      const heading = doc.heading as string;
      const verb = doc.action === "remove" ? "remove" : "rewrite";
      actions.push(
        textAction(
          id,
          root,
          doc.file,
          `${doc.file}: ${verb} section "${heading}"`,
          (t) =>
            editSection(
              t,
              heading,
              doc.action === "replace" ? doc.content : undefined,
              doc.intro
            )
        )
      );
    }
  }

  for (const raw of component.text ?? []) {
    const edit = substitute(raw, params);
    if (!edit) {
      if (hasText(readText(root, raw.file) ?? "", raw))
        skipped.push(
          `${raw.file}: replace "${raw.find}" by hand (needs --name or --repo-url)`
        );
      continue;
    }
    actions.push(
      textAction(
        id,
        root,
        edit.file,
        `${edit.file}: ${edit.replace ? "replace" : "remove"} ${preview(edit.find)}`,
        (t) => applyText(t, edit)
      )
    );
  }

  for (const raw of component.files ?? []) {
    const write = substitute(raw, params);
    if (!write) {
      skipped.push(`${raw.file}: rewrite by hand (needs --name or --repo-url)`);
      continue;
    }
    actions.push(
      textAction(
        id,
        root,
        write.file,
        `${write.file}: reset`,
        () => write.content
      )
    );
  }

  for (const file of markdownFiles(root)) {
    const text = readText(root, file) ?? "";
    if (!text.includes(`(\`${id}\`)`)) continue;
    actions.push(
      textAction(id, root, file, `${file}: remove the starter-only note`, (t) =>
        removeStarterNotes(t, id)
      )
    );
  }

  for (const path of [...(component.tests ?? []), ...(component.delete ?? [])])
    actions.push(deleteAction(id, root, path));

  return { actions, skipped };
}

/** The first line of a text, quoted and cut to 70 characters, for the plan. */
function preview(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  const lines = text.trim().split("\n").length;
  const cut = line.length > 70 ? `${line.slice(0, 67)}...` : line;
  return `"${cut}"${lines > 1 ? ` (${lines} lines)` : ""}`;
}

function deleteAction(component: string, root: string, path: string): Action {
  const full = join(root, path);
  const exists = existsSync(full);
  const kind = exists && statSync(full).isDirectory() ? "directory" : "file";
  return {
    component,
    description: `delete ${kind} ${path}`,
    done: !exists,
    run: () => rmSync(full, { recursive: true, force: true }),
  };
}

/** The Markdown files that may carry starter-only notes. */
function markdownFiles(root: string): string[] {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(root) },
    }
  );
  if (result.status === 0)
    return result.stdout
      .split("\n")
      .filter((file) => file && existsSync(join(root, file)));
  // Not a git checkout (a scratch copy): the docs and the READMEs are enough.
  const found: string[] = [];
  const walk = (dir: string) => {
    const full = join(root, dir);
    if (!existsSync(full)) return;
    for (const name of readdirSync(full)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const rel = dir ? `${dir}/${name}` : name;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith(".md")) found.push(rel);
    }
  };
  walk("");
  return found;
}

/** Heading ids as GitHub and the docs site make them (test/architecture/docs.test.ts). */
export function headingIds(source: string): Set<string> {
  const slugger = new GithubSlugger();
  const ids = new Set<string>();
  for (const [, , title] of headings(source.split("\n"))) {
    const text = title
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/`/g, "");
    ids.add(slugger.slug(text));
  }
  return ids;
}

/**
 * After a strip: every relative Markdown link to a file it deleted or a section it
 * removed becomes plain text (`[the QA inbox](#the-qa-inbox)` → `the QA inbox`), so the
 * docs keep no broken link. Returns the files it changed and how many links each lost.
 */
export function unlinkDangling(
  root: string
): { file: string; links: number }[] {
  const changed: { file: string; links: number }[] = [];
  const ids = new Map<string, Set<string>>();
  const idsOf = (file: string) => {
    if (!ids.has(file)) ids.set(file, headingIds(readText(root, file) ?? ""));
    return ids.get(file) as Set<string>;
  };
  for (const file of markdownFiles(root)) {
    const text = readText(root, file);
    if (text === null) continue;
    let count = 0;
    let fence: string | null = null;
    const next = text
      .split("\n")
      .map((line) => {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker) {
          if (fence === null) fence = marker;
          else if (marker.startsWith(fence)) fence = null;
          return line;
        }
        if (fence !== null) return line;
        return line.replace(
          /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g,
          (whole, label: string, href: string) => {
            if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/"))
              return whole;
            const hashAt = href.indexOf("#");
            const target = hashAt === -1 ? href : href.slice(0, hashAt);
            const anchor = hashAt === -1 ? "" : href.slice(hashAt + 1);
            const path = target
              ? join(dirname(file), decodeURI(target.split("?")[0] ?? ""))
              : file;
            const dangling =
              !existsSync(join(root, path)) ||
              (anchor !== "" &&
                path.endsWith(".md") &&
                !idsOf(path).has(decodeURIComponent(anchor)));
            if (!dangling) return whole;
            count++;
            return label;
          }
        );
      })
      .join("\n");
    if (count) {
      writeFileSync(join(root, file), next);
      ids.delete(file);
      changed.push({ file, links: count });
    }
  }
  return changed;
}

/** Marks components stripped in the manifest (keeps its formatting). */
export function markStripped(root: string, ids: readonly string[]): void {
  const path = join(root, MANIFEST);
  let text = readFileSync(path, "utf8");
  const manifest = JSON.parse(text) as Manifest;
  manifest.components.forEach((component, index) => {
    if (ids.includes(component.id) && component.status !== "stripped")
      text = modifyJsonc(text, ["components", index, "status"], "stripped");
  });
  writeFileSync(path, text);
}

/** What the owner does after the strip: secrets to delete and manual steps. */
export function nextSteps(components: readonly Component[]): string[] {
  const steps: string[] = [];
  for (const component of components) {
    for (const secret of component.secrets ?? []) {
      for (const where of secret.where) {
        steps.push(
          where === "github"
            ? `Delete the GitHub secret ${secret.name}${secret.note ? ` (${secret.note})` : ""} in the repository settings, if the project has it.`
            : `Delete the Worker secret ${secret.name} of ${where}, if it was set: bunx wrangler secret delete ${secret.name}${where === "develop" ? "" : ` --env ${where}`} (in apps/web).`
        );
      }
    }
    for (const doc of component.docs ?? [])
      if (doc.action === "rewrite")
        steps.push(`${doc.file}: ${doc.note ?? "rewrite for the project"}`);
    steps.push(...(component.manual ?? []));
  }
  return steps;
}
