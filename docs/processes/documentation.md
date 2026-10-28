# Documentation

Where each kind of knowledge lives and how docs are kept true. Use when you write or move a doc, decide where a fact belongs, or run the docs audit in [development.md](development.md#5-docs-audit).

## Doc types

| Type         | Location                                                  | Test: it belongs here if…                                              |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Guide        | `docs/` guides (currently `docs/guides/how-to-*.md`)      | it tells someone how to set up or do X, and is read while doing it     |
| Architecture | `docs/architecture/`                                      | it is a contract or principle that would survive a rewrite of the code |
| Process      | `docs/processes/`                                         | it describes how we work: plan, review, document, decide               |
| Decision     | `docs/decisions/`                                         | it records why a choice was made, as an ADR ([adrs.md](adrs.md))       |
| README       | next to code (`apps/*/README.md`, `packages/*/README.md`) | it is a fact that goes stale when that folder changes                  |
| Agent entry  | `AGENTS.md` (read by Claude Code, Codex and other agents) | it is an always-apply rule or a pointer to where to read next          |
| Skill        | `.claude/skills/<name>/SKILL.md`                          | it is a short task procedure an agent runs, pointing at the guide      |

## Rules

- **One home per fact.** Write it once, where its type says; link to it from elsewhere instead of copying. A skill summarises steps and links the guide.
- **Index entries are triggers.** Each entry in [docs/README.md](../README.md) says "Use when …", so a reader finds the doc from the task they have.
- **Current state, not history.** Docs describe what holds now. History lives in git and ADRs. No "we changed X", no "previously".
- **Delete obsolete docs.** Do not mark them deprecated; git is the archive. Remove links to them in the same PR.
- **Docs ship with the change.** A PR that changes behaviour, setup, config or a name updates every doc that mentions it.
- **Each doc starts with its purpose** in one paragraph and, where relevant, "Use when …".
- **Plain and specific.** Real paths, commands and names; tables for comparisons; no marketing tone.
- **Relative links** between files in the repo; no absolute machine paths.
