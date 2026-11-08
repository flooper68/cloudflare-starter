/**
 * The start prompt (apps/web/src/landing/start-prompt.ts), the one way the docs tell
 * people to start a project: it names the start-project skill and that skill exists, and
 * every place that shows the prompt quotes the same text. docs/guides/how-to-start-a-project.md
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { START_PROMPT, START_PROMPT_SKILL } from "@/landing/start-prompt";
import { readManifest } from "../../scripts/starter-strip-lib";
import { ROOT, read } from "./repo";

const SKILL = `.claude/skills/${START_PROMPT_SKILL}/SKILL.md`;
/** The starter itself (nothing stripped): README and the docs index still lead with it. */
const inStarter = readManifest(ROOT).components.every(
  (component) => component.status !== "stripped"
);

describe("start prompt", () => {
  it("names the start-project skill, the template and AGENTS.md", () => {
    expect(START_PROMPT_SKILL).toBe("start-project");
    expect(START_PROMPT).toContain(`${START_PROMPT_SKILL} skill`);
    expect(START_PROMPT).toContain(SKILL);
    expect(START_PROMPT).toContain(
      "https://github.com/flooper68/cloudflare-starter"
    );
    expect(START_PROMPT).toContain("AGENTS.md");
    expect(START_PROMPT).toContain("<name>");
  });

  it("points at a skill that exists and is named so", () => {
    expect(existsSync(join(ROOT, SKILL))).toBe(true);
    expect(read(SKILL)).toMatch(
      new RegExp(`^name: ${START_PROMPT_SKILL}$`, "m")
    );
  });

  it("AGENTS.md routes the prompt to the skill", () => {
    expect(read("AGENTS.md")).toContain(SKILL);
  });

  it.each(
    [
      "docs/guides/how-to-start-a-project.md",
      ...(inStarter ? ["README.md", "docs/README.md"] : []),
    ].map((file) => [file])
  )("%s shows the prompt verbatim", (file) => {
    expect(read(file)).toContain(`\`\`\`text\n${START_PROMPT}\n\`\`\``);
  });
});
