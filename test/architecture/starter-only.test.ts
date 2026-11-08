/**
 * starter-only.json, the manifest `bun run starter:strip` works from
 * (docs/processes/development.md#starter-only-parts), stays true to the repository:
 * - it is well formed, and every component has an id, a title, a why and a default;
 * - for an active component, every file and directory it deletes exists, every setting
 *   it changes is in apps/web/wrangler.jsonc or its JSON file, every CI job and step,
 *   doc section and text it edits is there, and its patch applies cleanly;
 * - a pending component has nothing on main yet (once its PR lands, mark it active);
 * - every "Starter-only, removed by `starter:strip`" note in the docs names a component.
 * Stripped components (in a project made from the template) are skipped. That the strip
 * leaves a working app is the CI job starter-strip (scripts/starter-strip-check.ts).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  findNodeAtLocation,
  type JSONPath,
  parse,
  parseTree,
} from "jsonc-parser";
import { describe, expect, it } from "vitest";

import {
  type Component,
  definedEnvironments,
  envJsonPath,
  jobRange,
  patchState,
  readManifest,
  STARTER_NOTE,
  sectionRange,
  stepRange,
  validateManifest,
  WRANGLER,
} from "../../scripts/starter-strip-lib";
import { filesUnder, ROOT, read } from "./repo";

const manifest = readManifest(ROOT);
const active = manifest.components.filter((c) => c.status === "active");
const pending = manifest.components.filter((c) => c.status === "pending");

function has(file: string, path: JSONPath): boolean {
  const tree = parseTree(read(file));
  return Boolean(tree && findNodeAtLocation(tree, path));
}

/** What an active component names that is not in the repository. */
function missing(component: Component): string[] {
  const problems: string[] = [];
  const exists = (path: string) => existsSync(join(ROOT, path));
  for (const path of [...(component.delete ?? []), ...(component.tests ?? [])])
    if (!exists(path)) problems.push(`${path} does not exist`);

  if (component.patch) {
    const state = patchState(ROOT, component.patch);
    if (state !== "applicable") problems.push(`${component.patch}: ${state}`);
  }

  for (const edit of component.wrangler ?? []) {
    const file = edit.file ?? WRANGLER;
    if (!exists(file)) {
      problems.push(`${file} does not exist`);
      continue;
    }
    const envs =
      edit.env === "all" ? definedEnvironments(read(file)) : [edit.env];
    for (const env of envs) {
      const path = envJsonPath(env, edit.path);
      // A removal names a setting that is there; a value may be new, its parent not.
      const target = edit.value === undefined ? path : path.slice(0, -1);
      if (!has(file, target))
        problems.push(`${file}: no ${target.join(".")}`);
    }
  }

  const wrangler = read(WRANGLER);
  const config = parse(wrangler) as Record<string, unknown>;
  for (const name of component.rateLimits ?? [])
    for (const env of definedEnvironments(wrangler)) {
      const block = (
        env === "develop"
          ? config
          : (config.env as Record<string, Record<string, unknown>>)[env]
      ) as { ratelimits?: { name: string }[] };
      if (!block.ratelimits?.some((binding) => binding.name === name))
        problems.push(`${WRANGLER} ${env}: no ratelimits binding ${name}`);
    }

  for (const edit of component.json ?? []) {
    const target =
      edit.value === undefined ? edit.path : edit.path.slice(0, -1);
    if (!exists(edit.file) || !has(edit.file, [...target]))
      problems.push(`${edit.file}: no ${edit.path.join(".")}`);
  }

  for (const ref of component.ci ?? []) {
    if (!exists(ref.workflow)) {
      problems.push(`${ref.workflow} does not exist`);
      continue;
    }
    const text = read(ref.workflow);
    const found = ref.step
      ? stepRange(text, ref.job, ref.step)
      : jobRange(text, ref.job);
    if (!found)
      problems.push(
        `${ref.workflow}: no ${ref.step ? `step "${ref.step}" in ` : ""}job ${ref.job}`
      );
  }

  for (const doc of component.docs ?? []) {
    if (!exists(doc.file)) {
      problems.push(`${doc.file} does not exist`);
      continue;
    }
    if (
      (doc.action === "remove" || doc.action === "replace") &&
      !sectionRange(read(doc.file), doc.heading ?? "", doc.intro)
    )
      problems.push(`${doc.file}: no heading "${doc.heading}"`);
  }

  for (const edit of component.text ?? []) {
    if (!exists(edit.file)) problems.push(`${edit.file} does not exist`);
    else if (!read(edit.file).includes(edit.find))
      problems.push(
        `${edit.file}: no longer contains ${JSON.stringify(edit.find.slice(0, 80))}`
      );
  }

  for (const write of component.files ?? [])
    if (!exists(write.file)) problems.push(`${write.file} does not exist`);
  return problems;
}

describe("starter-only.json", () => {
  it("is well formed", () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.components.length).toBeGreaterThan(0);
  });

  it.each(
    active.map((component) => [component.id, component] as const)
  )("%s names only what exists here", (_, component) => {
    expect(missing(component)).toEqual([]);
  });

  it.each(
    pending.map((component) => [component.id, component] as const)
  )("%s is still pending: none of its files are here yet", (_, component) => {
    const landed = [
      ...(component.delete ?? []),
      ...(component.tests ?? []),
    ].filter((path) => existsSync(join(ROOT, path)));
    expect(
      landed,
      "its PR has landed: list its parts and set status to active"
    ).toEqual([]);
  });

  it("every starter-only note in the docs names a component", () => {
    const ids = new Set(manifest.components.map((component) => component.id));
    const unknown = filesUnder(".", /\.md$/).flatMap((file) =>
      read(file)
        .split("\n")
        .map((line) => STARTER_NOTE.exec(line)?.[1])
        .filter((id): id is string => Boolean(id) && !ids.has(id as string))
        .map((id) => `${file}: ${id}`)
    );
    expect(unknown).toEqual([]);
  });
});
