# 0008. R2 through the binding and through presigned URLs

- Status: Accepted
- Date: 2026-10-28

## Context

Features store files in R2. There are two ways to reach it from a Worker, with different trade-offs: the `FILES` binding (bytes pass through the Worker) and S3-compatible presigned URLs (the browser talks to R2 directly). Which fits depends on the feature: file size, who downloads it, and whether every read must be authorized.

## Decision

The starter keeps both paths, sharing the `files` table, the key layout, the size limit and the ownership rule. Each feature chooses one:

| Use the binding (`env.FILES`) when           | Use presigned URLs when                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| every read must be authorized in the Worker  | uploads are large or should not pass through the Worker |
| files are written by the server or are small | a link is handed to someone outside the app             |
| no R2 API keys should exist                  | the bucket's CORS and an R2 API token are acceptable    |

A project deletes the path it does not use.

## Consequences

Positive:

- The binding path needs no keys and runs locally with no setup.
- The presigned path supports direct, large uploads and shareable links.
- Both are demonstrated with tests and MCP tools.

Negative:

- Two code paths to maintain until a project removes one.
- Presigned URLs need R2 API keys as secrets and bucket CORS, and are bearer tokens until they expire.
- The presigned path talks to the real bucket even in local dev.

## Alternatives considered

- **Binding only.** No direct large uploads or shareable links. Rejected as the starter default.
- **Presigned URLs only.** Requires keys and CORS for every project, and authorization happens only at signing time. Rejected as the starter default.
