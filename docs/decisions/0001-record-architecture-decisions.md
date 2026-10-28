# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-10-28

## Context

This starter is used by people and coding agents who were not present when its choices were made. Without a record, they either repeat settled debates or undo decisions without knowing the reasons. Architecture docs say what holds now but not why or what was rejected.

## Decision

We record significant decisions as Architecture Decision Records in `docs/decisions/`, in Michael Nygard's format (Title, Status, Date, Context, Decision, Consequences, Alternatives considered). The rules for when and how are in [processes/adrs.md](../processes/adrs.md). The architecture docs state the current rule and link the ADR that explains it.

## Consequences

Positive:

- Reasons and rejected alternatives survive the conversation they were decided in.
- Agents can check whether a change contradicts an accepted decision before proposing it.
- Reversing a decision is explicit: a new ADR supersedes the old one.

Negative:

- Writing an ADR costs time in the PR that makes the decision.
- ADRs and architecture docs can drift; the review checklist has to catch it.

## Alternatives considered

- **Decisions in PR descriptions only.** Not findable from the repository, and lost when the host changes. Rejected.
- **Reasons inline in architecture docs.** Mixes current rules with history and makes the docs long. Rejected.
- **A wiki outside the repo.** Not versioned with the code, not visible to agents working in the checkout. Rejected.
