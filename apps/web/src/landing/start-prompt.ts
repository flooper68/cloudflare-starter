/**
 * The prompt that starts a project from the starter: pasted into a coding agent (Claude
 * Code or similar) in an empty folder, it makes the owner's repository from the template
 * and runs the start-project skill (.claude/skills/start-project/SKILL.md). The one source
 * of the text: the landing page shows this constant, and README.md, docs/README.md and
 * docs/guides/how-to-start-a-project.md quote it verbatim (test/architecture/starter-only.test.ts).
 * `<name>` is the only part the owner edits.
 */
export const START_PROMPT =
  "Create a new agent-native app called <name> from the template https://github.com/flooper68/cloudflare-starter. Read its AGENTS.md first, then follow its start-project skill (.claude/skills/start-project/SKILL.md). Ask me for each decision it needs, and before every change to my GitHub or Cloudflare account.";

/** The skill the prompt names; it must exist in .claude/skills/. */
export const START_PROMPT_SKILL = "start-project";
