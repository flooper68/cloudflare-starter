# 0001: Bind factor assurance to the verified session

Status: proposed implementation of the approved security milestone, pending shipping review.

Date: 2026-10-31

## Context

Better Auth creates a provisional session before its password two-factor hook removes it and creates a challenge. Enrollment alone does not prove that a browser or OAuth client completed the factor. Looking at a user's newest session would authorize unrelated tokens.

## Decision

A final auth plugin stamps server-owned session evidence after native verification. Application/API/admin policy reads current enrollment and exact session evidence. OAuth grant extensions carry that session ID to MCP, which rechecks it and rejects revoked or expired associations. Passkeys remain primary credentials because the pinned plugin does not require user verification. Destructive admin actions require an explicit recent factor rather than remembered-device evidence.

## Consequences

A revoked/expired granting browser session ends the corresponding MCP authorization in every policy mode; minting a user token without that association fails closed. Reconnecting is explicit. Auth plugin upgrades require hook-ordering and ceremony regression tests. This avoids a separate ambient assurance cache and cannot grant trust from a caller-supplied field, enrollment flag or another browser session.
