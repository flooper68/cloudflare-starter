# 0009. Exact dependency pins, updated when a project starts

- Status: Accepted
- Date: 2026-10-28

## Context

The starter is a template copied into new projects, sometimes long after it was last touched. Version ranges (`^`, `~`) make an install resolve to different versions on different days, so the same commit can build on one machine and fail on another. A template also ages: its pins are only as fresh as its last update.

## Decision

Every dependency in every `package.json` is pinned to an exact version. `bunfig.toml` sets `[install] exact = true`, so `bun add` and `bun update` write exact versions. A project started from the starter updates all dependencies first (`bun update --latest` in the root and each workspace, then `bun run verify && bun run build`), as the README describes. Known hold: `typescript` stays on the latest 6.x until `astro check` supports TypeScript 7.1+. Peer ranges in `packages/ui` are bumped by hand. GitHub Actions are pinned to full commit SHAs with the version in a comment.

## Consequences

Positive:

- Reproducible installs; `bun.lock` and `package.json` agree.
- Upgrades are explicit, reviewable changes.

Negative:

- No automatic patch updates, including security fixes; someone has to update.
- Starting a project includes an update pass and reading changelogs of major bumps.

## Alternatives considered

- **Caret ranges with the lockfile as the only pin.** The lockfile pins installs, but `package.json` stops saying what is actually used, and fresh resolves or lockfile regeneration pull new versions silently. Rejected.
