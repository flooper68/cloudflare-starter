# Development Process

The loop every change follows, by a person or an agent: plan, implement, verify, produce evidence, audit docs, self-review, ship on the owner's yes. It also defines the plan schema for work handed to an agent and the definition of done. Use when you start any change, and again before you say it is finished.

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
2. For each old and new name, search: `grep -rn "<name>" docs README.md CLAUDE.md apps/*/README.md packages/*/README.md .claude apps/web/.dev.vars.example apps/web/wrangler.jsonc scripts`.
3. Update every hit, in this PR. New knowledge goes where the [docs index](../README.md) leads ([documentation.md](documentation.md)).
4. Write "nothing to update" only after the search, and list what you searched.

### 6. Self-review

Per [code-review.md](code-review.md): pick the risk tier, run the six checklists, fix Critical and High findings, re-verify.

### 7. Ship

Commit, push, open a PR, run a deploy, create Cloudflare resources or set secrets only on the owner's explicit yes for that action. Dry-run first (`--dry-run` on the setup scripts). The PR uses [the template](../../.github/pull_request_template.md).

## Unexpected-problem gate

When implementation hits something the plan did not settle (a failing assumption, a missing API, a test that cannot pass as specified, a conflict with a principle), stop and ask the owner, with the options and a recommendation. Continue without asking only when there is one safe, documented answer that changes neither scope nor approach; note it in the PR.

On an unexpected error, first search the docs and skills for the exact error text.

## Definition of done

- [ ] Code follows [architecture/overview.md](../architecture/overview.md); no new item for "Current state vs target".
- [ ] Every test [testing.md](../architecture/testing.md) requires for this change exists and fails without the change.
- [ ] `bun run verify` passes; `bun run build` passes if app code or config changed; commands and results recorded.
- [ ] Evidence captured and attached to the PR.
- [ ] Docs audit done; docs, `.dev.vars.example`, `wrangler.jsonc` comments, scripts and skills updated in the same PR.
- [ ] ADR written or "not needed because …" ([adrs.md](adrs.md)).
- [ ] Self-review done; Critical/High findings fixed; Medium/Low listed for the owner.
- [ ] Machine clean (below).
- [ ] The owner said yes before anything was shipped.

## Machine hygiene

- Stop every dev server, watcher, tunnel and browser session you started.
- Scratch files, screenshots, recordings and logs go to a scratch directory outside the repo, never into a commit.
- `git status` shows only the files the change intends.

## Plan schema

The plan for work handed to an agent (also the [feature issue template](../../.github/ISSUE_TEMPLATE/feature.md)). One PR per item; split work that a reviewer could not check in one sitting (several features, or a refactor mixed with new behaviour) into items that each ship on their own.

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
