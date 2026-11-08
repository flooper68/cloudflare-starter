/**
 * Every skill and subagent shipped in `.claude/` has an entry in the catalogue
 * (docs/processes/agent-skills.md), and every entry names one that exists:
 * - a skill is `.claude/skills/<name>/SKILL.md` whose front matter `name` is `<name>`;
 * - a subagent is `.claude/agents/<name>.md` whose front matter `name` is `<name>`;
 * - an entry is a table row whose first cell links to that file.
 * Agents find skills by their description, so each needs one too.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT, read } from "./repo";

const CATALOGUE = "docs/processes/agent-skills.md";

function frontMatter(source: string): Record<string, string> {
  const block = /^---\s*\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = /^([a-z-]+):\s*(.*)$/.exec(line.trim());
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

function listDir(dir: string): string[] {
  const full = join(ROOT, dir);
  return existsSync(full) ? readdirSync(full) : [];
}

const SKILLS = listDir(".claude/skills")
  .filter((name) => existsSync(join(ROOT, ".claude/skills", name, "SKILL.md")))
  .map((name) => ({ name, path: `.claude/skills/${name}/SKILL.md` }));
const AGENTS = listDir(".claude/agents")
  .filter((file) => file.endsWith(".md"))
  .map((file) => ({
    name: file.replace(/\.md$/, ""),
    path: `.claude/agents/${file}`,
  }));
const SHIPPED = [...SKILLS, ...AGENTS];

/** The repository paths the catalogue's table rows link to in their first cell. */
function catalogued(): string[] {
  const paths: string[] = [];
  for (const line of read(CATALOGUE).split("\n")) {
    if (!line.startsWith("|")) continue;
    const firstCell = line.split("|")[1] ?? "";
    const href = /\[[^\]]*\]\(([^)\s#]+)/.exec(firstCell)?.[1];
    if (!href?.includes(".claude/")) continue;
    paths.push(`.claude/${href.split(".claude/")[1]}`);
  }
  return paths;
}

describe("agent catalogue", () => {
  it("finds the shipped skills and subagents (the checks below are not vacuous)", () => {
    expect(SKILLS.length).toBeGreaterThan(0);
    expect(AGENTS.length).toBeGreaterThan(0);
  });

  it.each(SHIPPED)("$path names itself and says when to use it", (entry) => {
    const fields = frontMatter(read(entry.path));
    expect(fields.name, `front matter name of ${entry.path}`).toBe(entry.name);
    expect(fields.description?.length ?? 0).toBeGreaterThan(20);
  });

  it.each(SHIPPED)(`$path has an entry in ${CATALOGUE}`, (entry) => {
    expect(
      catalogued(),
      `add a row for ${entry.name} to ${CATALOGUE}, its link to ${entry.path} in the first cell`
    ).toContain(entry.path);
  });

  it("lists nothing that is not shipped", () => {
    const shipped = new Set(SHIPPED.map((entry) => entry.path));
    expect(catalogued().filter((path) => !shipped.has(path))).toEqual([]);
  });
});
