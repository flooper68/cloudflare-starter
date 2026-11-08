# Development Process

The loop every change follows, by a person or an agent: plan, implement, verify, produce evidence, audit docs, self-review, ship on the owner's yes. It also defines the plan schema for work handed to an agent and the definition of done. Use when you start any change, and again before you say it is finished. How an orchestrator agent runs this loop with implementer and reviewer subagents: [agentic-workflow.md](agentic-workflow.md).

## The loop

| Step           | What happens                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Plan        | For non-trivial work, write a plan ([schema below](#plan-schema)) and settle open questions with the owner.                                   |
| 2. Implement   | Follow the plan and [architecture/overview.md](../architecture/overview.md). Stop at the [unexpected-problem gate](#unexpected-problem-gate). |
| 3. Verify      | Run the narrowest check that gives real evidence, then the full one. Record command and result.                                               |
| 4. Evidence    | Capture screenshots and walkthroughs of the changed behaviour ([Evidence](#4-evidence)).                                                      |
| 5. Docs audit  | Find everything the diff changed that someone could notice and update the docs that mention it.                                               |
| 6. Self-review | Review the diff per [code-review.md](code-review.md); risky changes get an independent reviewer.                                              |
| 7. Ship        | Commit, push, open a PR or deploy only after the owner's explicit yes.                                                                        |

### 1. Plan

Trivial changes (a typo, a one-line fix with an obvious test) skip the written plan. Everything else gets one.

Questions to the owner:

- Ask only questions whose answer changes the implementation.
- Ask in small batches (three to five), ordered scope → behaviour → trade-offs.
- Give each question a recommended answer and the reason, so the owner can reply "yes".
- Record the answers in the plan or issue; they are the task contract the reviewer gets.

### 2. Implement

Imitate the closest existing code the plan names, unless it is listed in [Current state vs target](../architecture/overview.md#current-state-vs-target). Write the required tests from [testing.md](../architecture/testing.md) with the code, not after.

### 3. Verify

- Start with the narrowest check that proves the change (one test file, one `curl`, one story), then run `bun run verify`, and `bun run build` when app code or config changed.
- Record each command and its result (pass/fail, counts, the relevant output line) for the PR's verification record.
- Never hide a failure: no skipped tests, no weakened assertions, no `--no-verify`, no deleting a check to get green. A failure you cannot fix goes into the report as a failure.

### 4. Evidence

Producing evidence is part of done, before asking to ship.

- UI changes: a screenshot of each changed screen and state (empty, loading, error, filled) in both themes; before/after for changes to existing screens.
- Flows (a form, a multi-step journey, an upload): a short walkthrough video or GIF.
- API and agent flows where possible: a terminal recording or the captured output of the request, and the MCP tool call with its result.
- Say how each piece was produced (command, URL, browser, account type), so the reviewer can reproduce it.
- Agents capture it with the browser tools or Playwright against `bun run dev:web`.
- Evidence is attached to the PR, never committed to the code branches. People drag files into the PR description. Agents, which cannot upload attachments with `gh`, push the files to the orphan `pr-evidence` branch under `pr-<number>/` (or `<branch-name>/` before the PR exists) and link them from the description with `https://github.com/<owner>/<repo>/blob/pr-evidence/<path>?raw=true`. That branch shares no history with the code; prune it when it grows.

### 5. Docs audit

1. List what the diff changed that someone could notice: commands, scripts, env vars, secrets, bindings, Cloudflare resources, routes, MCP tools, file paths, CI jobs, deploy steps, UI behaviour.
2. For each old and new name, search: `grep -rn "<name>" docs README.md AGENTS.md apps/*/README.md packages/*/README.md .claude apps/web/.dev.vars.example apps/web/wrangler.jsonc scripts`.
3. Update every hit, in this PR. New knowledge goes where the [docs index](../README.md) leads ([documentation.md](documentation.md)).
4. Write "nothing to update" only after the search, and list what you searched.
5. If a user or adopter would notice the change, add a line under `## [Unreleased]` in [CHANGELOG.md](../../CHANGELOG.md) ([Changelog](#changelog)).

### 6. Self-review

Per [code-review.md](code-review.md): pick the risk tier, run the six checklists, fix Critical and High findings, re-verify.

### 7. Ship

Commit, push, open a PR, run a deploy, change the owner's Cloudflare account, create resources, set secrets or change GitHub settings only on the owner's explicit yes for that action. A request that names the action ("build X and open a PR", "deploy it to staging") is that yes, and a brief written from it passes the yes on to the agent doing the work ([agentic-workflow.md](agentic-workflow.md#what-agents-may-do-on-their-own)). Dry-run first (`--dry-run` on the setup scripts). The PR uses [the template](../../.github/pull_request_template.md).

## Changelog

[CHANGELOG.md](../../CHANGELOG.md) at the repository root records what changed in each release for people evaluating the starter or building on it. It follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and the docs site renders it as release notes at `/docs/changelog/` with an Atom feed at `/docs/changelog.xml` ([how-to-publish-docs-and-landing.md](../reference/docs-site.md#changelog)).

**Every PR that changes something a user or adopter notices adds a line under `## [Unreleased]`**: a new capability, a changed behaviour, setting, command, route or default, a removal or deprecation, a security change, a fix of something people could hit. Internal refactors, test-only changes and docs typo fixes need none.

- Put it under the right group, in this order: `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, `### Security`. Add the group if it is missing.
- One bullet per capability, in plain words, naming what someone gets or must do ("`STORAGE_RECONCILE` is now required"), not the PR or the files. A **bold lead** naming the area helps in long groups.
- Say what an adopter must change in a `Changed` or `Removed` line (a renamed setting, a migration to run).
- No PR numbers, no agent or tool names, no marketing.

`test/architecture/changelog.test.ts` fails when the structure breaks: the `# Changelog` title, one `## [Unreleased]` first, `## [X.Y.Z] - YYYY-MM-DD` releases newest first, only the six group headings in their order and never empty, plain `- ` bullets, and a link reference per release with the right compare or tag URL.

### Releasing a version

The owner decides when to release and which number (SemVer: a breaking change for adopters is a major, before 1.0.0 a minor; new capabilities a minor; only fixes a patch).

1. In a PR, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` (the release date), add a new empty `## [Unreleased]` above it, and optionally a one-paragraph summary under the version heading.
2. Update the link references at the bottom: `[Unreleased]` compares `vX.Y.Z...HEAD`, and `[X.Y.Z]` compares the previous tag with `vX.Y.Z` (the first release links `releases/tag/vX.Y.Z`). `bun run test:unit` checks them.
3. After the PR is merged, tag the merge commit and push the tag: `git tag -a vX.Y.Z -m "vX.Y.Z" <commit>` and `git push origin vX.Y.Z`. Optionally create a GitHub release from the tag with the section's text.
4. Deploy as usual; the release notes and the feed update with the deploy.

## Starter-only parts

Some of this repository exists only for the starter's own public instance at `starter.flooper.me` and its repository: its QA automation, demos, marketing, production values. A project made from the template removes them with `bun run starter:strip` ([how-to-start-a-project.md](../guides/how-to-start-a-project.md)), which works from the manifest `starter-only.json` at the root.

- **Any new starter-only part goes into the manifest in the same PR**: a new component, or the files, settings, rate limits, secrets, CI jobs, docs and tests it adds to an existing one. Ask "would a new project built from the template delete or replace this?"; if yes, it is starter-only.
- A guide that documents a starter-only part says so with a blockquote the strip removes, starting ``> **Starter-only, removed by `starter:strip`** (`<component id>`):``.
- Prefer manifest operations that survive edits around them: settings (`wrangler`, `json`), CI jobs and steps (`ci`), doc sections (`docs`), exact text (`text`). Use a `patch` only for code edits too entangled for `text`; regenerate it when the code it edits changes (apply it to a copy with `git apply --3way`, fix the conflicts, then `git diff > scripts/starter-only/<id>.patch` on the edited files).
- A component whose PR has not landed is `"status": "pending"` with the PR it waits for; when the PR merges, list its parts and set it `active`.
- `test/architecture/starter-only.test.ts` checks that every path, setting, job, section and text the manifest names exists and every patch applies; the CI job `starter-strip` applies the default set to a scratch copy and runs typecheck, lint and test there (`bun run starter:strip:check`, `--each` for every component on its own, `--all` for all at once).

## Authorship and attribution

The person who asked for the work is the author. Never credit an AI agent as author or co-author in commits, PR descriptions or code: no agent `Co-Authored-By` trailers or "Generated with …" lines. CI checks commits with `scripts/check-attribution.ts`.

## Unexpected-problem gate

When implementation hits something the plan did not settle (a failing assumption, a missing API, a test that cannot pass as specified, a conflict with a principle), stop and ask the owner, with the options and a recommendation. Continue without asking only when there is one safe, documented answer that changes neither scope nor approach; note it in the PR.

On an unexpected error, first search the docs and skills for the exact error text.

## Definition of done

- [ ] Code follows [architecture/overview.md](../architecture/overview.md); no new item for "Current state vs target".
- [ ] Every test [testing.md](../architecture/testing.md) requires for this change exists and fails without the change.
- [ ] `bun run verify` passes; `bun run build` passes if app code or config changed; commands and results recorded.
- [ ] Evidence captured and attached to the PR.
- [ ] Docs audit done; docs, `.dev.vars.example`, `wrangler.jsonc` comments, scripts and skills updated in the same PR.
- [ ] A user- or adopter-visible change has its line under `## [Unreleased]` in `CHANGELOG.md`.
- [ ] ADR written or "not needed because …" ([adrs.md](adrs.md)).
- [ ] Self-review done; Critical/High findings fixed; Medium/Low listed for the owner.
- [ ] Machine clean (below).
- [ ] The owner said yes before anything was shipped.

## Machine hygiene

- Stop every dev server, watcher, tunnel and browser session you started.
- Scratch files, screenshots, recordings and logs go to a scratch directory outside the repo, never into a commit.
- `git status` shows only the files the change intends.

## Plan schema

The plan for work handed to an agent, written into the task brief or the PR description. One PR per item; split work that a reviewer could not check in one sitting (several features, or a refactor mixed with new behaviour) into items that each ship on their own.

| Section               | Content                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Goal                  | What the user or the owner can do afterwards, in one or two sentences                                 |
| Approach              | The chosen design, and the options considered and rejected with one-line reasons                      |
| Out of scope          | What this item does not do, so nobody adds it                                                         |
| Blast radius          | Files, features, routes, bindings, environments and users affected; migration or data impact          |
| Tests                 | The tests required by [testing.md](../architecture/testing.md), by layer                              |
| Evidence              | Which screens, flows or tool calls will be captured                                                   |
| Docs to update        | Guides, READMEs, skills, `.dev.vars.example`, `wrangler.jsonc` comments                               |
| Closest existing code | The file(s) to imitate, checked against "Current state vs target"                                     |
| Key shapes            | Input/output types, table columns, tool names, anchored to the real files they extend (path + symbol) |
| Risks and assumptions | Each with the default the implementer takes if it turns out wrong                                     |
| ADR                   | Needed (title) or not needed, with the reason                                                         |
