# 0002. Explicit data catalog and bounded export/erasure pipelines

Status: Proposed

Date: 2026-10-31

## Context

Every feature can add user data, while authentication credentials and shared workspace data require different access and retention treatment. R2 objects do not cascade with D1. ZIP encoders retain state that cannot simply be serialized into queue messages. The owner approved exports/erasure with fflate behind a port and audit redaction; on 31 October the owner clarified that operational plan/usage rows are erased because this starter has no fiscal records.

## Decision

Use one explicit catalog of whitelisted export projections and erasure/retention treatment per persisted table. Export in a leased queue attempt using bounded SQL pages, streamed objects, a Zip port backed by fflate and 5 MiB multipart writes. Retry by aborting recorded stale multipart state and rebuilding a unique archive. Publish only after a final authorization check; downloads require an expiring signature plus current authenticated authorization. Bound archives at 1 GiB/10,000 entries and fail visibly rather than truncate.

All account deletions share preflight, external-object cleanup and auth-gateway credential deletion. Binding uploads recheck their exact reference after R2 writes; temporary non-cascading cleanup intents make failures retryable. Already-issued one-hour presigned PUTs receive a mandatory prefix sweep after that window and another 24 hours after the first successful sweep, independently of optional general reconciliation. Preserve last-owner/admin rules, serialize erasures across auth hooks, remove operational billing state and keep a minimal erasure id/timestamp ledger for restore reconciliation. Redact only the defined subject information from audit events. Browser-only admin erasure closes the historical MCP removal alias too.

## Consequences

New tables cannot silently miss the privacy catalog. Export memory is bounded and incomplete archives have recoverable cleanup state. Jobs can restart expensive work after failure, and very large projects must adopt a resumable archive format or raise limits with evidence. A restore operator must carry forward and reapply the minimal erasure ledger. Issued presigned URLs are not cryptographically revoked by D1 erasure, and extremely slow accepted uploads or sustained service failures can extend physical cleanup beyond the normal sweeps; no instant-deletion or universal compliance promise is made.

## Alternatives considered

- Export every SQL column: leaks credentials and conflates private/shared data.
- Buffer a ZIP in memory: violates Worker memory limits for ordinary file collections.
- Persist opaque fflate encoder state between queue messages: unsupported and fragile across runtime/library changes.
- Keep billing rows indefinitely under a generic GDPR exception: operational plan data is not fiscal evidence; the owner chose deletion and future provider-specific policy.
