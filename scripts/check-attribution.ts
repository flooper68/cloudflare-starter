/**
 * `bun scripts/check-attribution.ts [<base-ref>]` — fails if any commit since <base-ref>
 * (default origin/main) names an AI agent as author or co-author, or carries a
 * "Generated with <agent>" line. Rule 9 in CLAUDE.md; run by CI on pull requests.
 */
import { spawnSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const AGENTS =
  /claude|anthropic|codex|openai|chatgpt|copilot|gemini|cursor|devin|\bagent\b/i;

const log = spawnSync(
  "git",
  ["log", "--format=%H%x1f%an <%ae>%x1f%B%x1e", `${base}..HEAD`],
  { encoding: "utf8" }
);
if (log.status !== 0) {
  console.error(log.stderr.trim());
  process.exit(2);
}

const problems: string[] = [];
for (const entry of log.stdout.split("\x1e")) {
  const [sha, author, message] = entry.trim().split("\x1f");
  if (!sha || author === undefined || message === undefined) continue;
  const short = sha.slice(0, 7);
  if (AGENTS.test(author)) problems.push(`${short}: author "${author}"`);
  for (const line of message.split("\n")) {
    if (/^co-authored-by:/i.test(line.trim()) && AGENTS.test(line)) {
      problems.push(`${short}: "${line.trim()}"`);
    }
    if (/generated (with|by)/i.test(line) && AGENTS.test(line)) {
      problems.push(`${short}: "${line.trim()}"`);
    }
  }
}

if (problems.length > 0) {
  console.error("Commits must not credit AI agents (CLAUDE.md rule 9):");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("Reword the commits (e.g. git rebase -i) to drop these lines.");
  process.exit(1);
}
console.log(`✓ no agent attribution in commits since ${base}`);
