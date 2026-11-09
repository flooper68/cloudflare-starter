---

name: update-dependencies
description: Run one dependency update and security audit pass of this repository, as the daily scheduled agent does or by hand — bun outdated, routine and risky updates grouped into pull requests, the files outside package.json, derived files regenerated, the verify steps, bun audit with the four triage questions, reachable runtime findings fixed first. Opens pull requests through the normal checks, never merges a risky update, and does nothing when nothing is outdated and the audit is clean. Use when the daily trigger fires, or when the user asks to update dependencies, run an audit or check an advisory.
---

# Update dependencies

One pass of [docs/processes/dependencies.md](../../../docs/processes/dependencies.md), the one home of the steps, commands and triage rules. This skill is the order to run them in and what to report. A scheduled agent runs it every day; a person or agent runs the same skill by hand.

## 1. Start clean

1. Fetch and start from the default branch: `git fetch origin`, then a new branch per pull request from `origin/main` (for example `deps/routine-<date>`, `deps/<package>-<version>`).
2. If an open pull request from an earlier pass already covers an update (`gh pr list --search "deps/" --state open`), do not open a second one: update that branch or leave it for its reviewer.
3. `bun install`.

## 2. Look

1. `bun outdated --recursive`.
2. The [Not in package.json](../../../docs/processes/dependencies.md#not-in-packagejson) table, row by row (compatibility date, GitHub Actions SHAs, Node, Bun, Playwright browsers, container base image, self-hosted runner image).
3. `bun audit`, and re-check every row of [Overrides and accepted advisories](../../../docs/processes/dependencies.md#overrides-and-accepted-advisories): remove a row whose "Remove when" now holds.
4. **Nothing outdated, nothing to remove and a clean audit: stop.** Open nothing, change nothing, and report "nothing to do" with the three commands' results.

## 3. Audit findings first

For each advisory, answer the [four triage questions](../../../docs/processes/dependencies.md#triage-a-finding) in order (installed? where it runs? reachable? impact?) and take the first [fix path](../../../docs/processes/dependencies.md#fix-paths) that works (update, override with a row, replace, accept). A reachable runtime finding (Worker or browser) is Critical or High: fix it in its own pull request before any other update, with the smallest change, and tell the owner at once ([In production](../../../docs/processes/dependencies.md#in-production)). Never accept an advisory yourself: propose it with the answers; the owner accepts.

## 4. Group and update

Per [Update](../../../docs/processes/dependencies.md#update):

- **Routine** (patches and minors with a quiet changelog): one pull request for the whole pass.
- **Risky** (a major, a migration guide, or the framework core named there): one pull request per package or tightly coupled family. Read the changelog and the migration guide, and note each breaking change that affects this code and how it was handled.
- Keep the documented holds. In a routine pass prefer versions out for some days ([Supply chain](../../../docs/processes/dependencies.md#supply-chain)); take a fresh one only when it is the security fix.
- Regenerate what the updated packages derive (the Better Auth tables, `@cloudflare/workers-types`, Drizzle migrations), per the table in step 5 of the process.

## 5. Verify

Step 6 of [Update](../../../docs/processes/dependencies.md#update), in each branch: `bun run verify`, `bun run build`, `bun run test:components`, `bun run test:e2e`, the deploy dry run per environment, and for a risky update with runtime changes a manual pass captured as evidence. Record every command and result. A failure you cannot fix stays in the pull request as a failure; never skip or weaken a check.

## 6. Open pull requests

- Use [the template](../../../.github/pull_request_template.md): the verification record, the triage answers, the changelog notes, "no user-visible change" for a routine pass, and a line under `## [Unreleased]` in `CHANGELOG.md` when adopters notice it (a security fix, a changed requirement).
- Follow the [attribution policy](../../../docs/processes/development.md#authorship-and-attribution).
- Wait for the required checks (`gh pr checks <n> --watch`) and fix what fails.
- **Never merge a risky update, an override or an accepted advisory on your own**: they wait for the owner's review. A routine pull request is merged only where the owner has said routine passes may be merged once the required checks are green; otherwise it waits too. Never deploy.

## 7. Report

One short report to the owner (the scheduled run's output, or the conversation): what was outdated, each pull request with its number, group and check result, each audit finding with its triage and fix, what was left alone and why, and anything that needs their decision. "Nothing to do" when step 2 stopped the pass.
