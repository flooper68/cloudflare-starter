## What and why

<!-- What changes for users, agents or developers, and why. -->

Closes #

## How to test

<!-- Steps a reviewer can follow, from a clean checkout. -->

## Verification record

<!-- Each command you ran and its result. Failures stay in the list. -->

| Command          | Result |
| ---------------- | ------ |
| `bun run verify` |        |
| `bun run build`  |        |

## Evidence

<!-- Drag files into the PR, or (agents) link them from the pr-evidence branch; never commit them to code branches. See docs/processes/development.md#4-evidence. -->

- [ ] Screenshots of each changed screen and state, in light and dark theme (UI changes)
- [ ] Short walkthrough video or GIF of each changed flow
- [ ] Before/after for changes to existing behaviour
- [ ] API or agent flows: terminal recording or captured output, MCP tool call and result
- [ ] How the evidence was produced (command, URL, browser, account):
- [ ] Not applicable because:

## Docs audit

<!-- What was updated, or "searched: <terms> in <paths>; nothing to update". -->

## New or changed config

<!-- Each env var, secret, binding, Cloudflare resource, script or CI change, with where it is documented. Write "none" if none. -->

| Item | Kind | Environments | Documented in |
| ---- | ---- | ------------ | ------------- |

## Dependencies and performance

<!-- New or updated dependencies: what for, changelogs read, `bun audit` result (docs/processes/dependencies.md). Changes to queries, bundles or request paths: effect on the project's performance budgets (docs/architecture/performance.md). Write "none" if neither applies. -->

## ADR

<!-- Link to docs/decisions/NNNN-*.md, or "not needed because …". -->

## Review findings

<!-- Each finding from self-review or the reviewer agent: severity, file:line, and how it was handled (fixed / refuted: reason / accepted by owner: reason / scope conflict). -->

## Process changes

- [ ] No AI agent is credited in the commits or this description (CLAUDE.md rule 9)

- [ ] This PR changes `docs/processes/` or `CLAUDE.md` (describe the change above)
