# Decisions

Architecture Decision Records of the project built from this starter: why it is built the way it is, and which alternatives were rejected. The starter itself ships none; the first decision a project records is 0001. The current rules are in [architecture/overview.md](../architecture/overview.md); how to write an ADR is in [processes/adrs.md](../processes/adrs.md). Use when you want to know why something is the way it is, or before proposing to change it.

| ADR | Decision | Status |
| --- | -------- | ------ |

New ADR: copy [0000-template.md](0000-template.md) to the next free number (`0001-…` first) and add a row here.


Account security: [authenticators, passkeys, required enrollment and session-bound MCP assurance](../guides/how-to-configure-account-security.md). Verify factor setup/challenge/recovery, stale or unrelated session refusal, last-factor removal, and browser-only administrative reset when changing authentication.
