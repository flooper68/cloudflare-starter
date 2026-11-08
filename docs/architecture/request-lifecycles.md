# Request lifecycles

How each kind of work moves through the Worker, step by step: a page, a tRPC mutation, an MCP tool call, a background job, a cron run and a sign-up. Use when you debug a request end to end, add a step to one of these paths, or need to know where a check runs.

Every diagram reads top to bottom; solid arrows are calls, dashed arrows answers. Each on-demand request first passes the middleware of [the page request](#a-page-request), so the later diagrams start after it.

## A page request

```mermaid
sequenceDiagram
  accTitle: A page request through the middleware
  accDescr: Prerendered pages (landing, docs, 404) are static assets served with the headers of public/_headers, without running the Worker. A server-rendered page such as /app/notes goes through the middleware. It builds the request context and trace id and opens the server span, resolves the Better Auth cookie into a session, redirects an anonymous /app request to /sign-in, checks the session's security state (second factor), renders the page, and adds the security headers, including a per-page Content-Security-Policy with Astro's script hashes, plus x-request-id and traceparent. Pages are not rate limited, except the token pages /invite and /unsubscribe.
  participant B as Browser
  participant S as Static assets
  participant M as Middleware
  participant A as Better Auth
  participant D as D1
  participant P as Astro page
  B->>S: GET /docs/... (prerendered)
  S-->>B: HTML with the _headers CSP, Worker not run
  B->>M: GET /app/notes
  Note over M: request context, trace id, server span
  M->>A: getSession(cookie)
  A->>D: session (cookie cache 60 s)
  A-->>M: user and session, or none
  alt no session on /app
    M-->>B: 302 /sign-in
  end
  M->>D: getSecurityState: session valid, second factor
  M->>P: next()
  P-->>M: HTML
  Note over M: security headers, CSP with Astro's hashes
  M-->>B: 200, x-request-id, traceparent
```

The middleware is [apps/web/src/server/app-middleware.ts](../../apps/web/src/server/app-middleware.ts); the request context, server span and `http.server.request.duration` come from `withRequestContext` in [http.ts](../../apps/web/src/server/http.ts), the headers from [security-headers.ts](../../apps/web/src/server/security-headers.ts). Auth endpoints, `/.well-known/*`, `/mcp` and `/api/csp-report` skip the cookie session. An unhandled error becomes a 500 Problem Details whose `reference` is the trace id. Guide: [how-to-configure-security-headers.md](../guides/how-to-configure-security-headers.md).

## A tRPC mutation

```mermaid
sequenceDiagram
  accTitle: A tRPC mutation, notes.create
  accDescr: The SPA posts notes.create to /api/trpc with the x-trpc-source header, after the middleware resolved the session. The procedure chain opens a span, counts the mutation against its rate limit (mutation.user), requires a user, checks the session's security state, and resolves the actor (user, workspace, role) from the workspace membership. The createNote use case checks the notes.write permission and the plan's notes limit, inserts the note, records the note.created audit event and tracks the notes.created product event without waiting. The response carries RateLimit-Policy; the request's metrics are flushed when it ends.
  participant B as SPA
  participant T as /api/trpc
  participant R as Procedure chain
  participant L as Rate Limiting
  participant U as createNote
  participant D as D1
  participant E as Analytics Engine
  B->>T: POST notes.create, x-trpc-source app
  Note over T: 403 without the header
  T->>R: createAppContext(user, request context)
  Note over R: span and rpc.server.call.duration
  R->>L: limitMutations: mutation.user
  R->>D: protectedProcedure: getSecurityState
  R->>D: workspaceProcedure: resolveActor
  R->>U: createNote(ctx, actor, input)
  Note over U: requirePermission notes.write
  U->>D: billing.requireLimit notes
  U->>D: insert into notes
  U->>D: recordAuditEvent note.created
  U-)E: trackEvent notes.created
  U-->>R: id, createdAt
  Note over R: DomainError mapped to a tRPC error
  R-->>T: result
  T-->>B: 200, RateLimit-Policy
```

The chain is in [trpc/init.ts](../../apps/web/src/server/trpc/init.ts) (`publicProcedure` → `protectedProcedure` → `workspaceProcedure`), the procedure in [notes-router.ts](../../apps/web/src/server/trpc/notes-router.ts), the use case in [create-note.ts](../../packages/features/src/notes/create-note.ts). The rate limit runs before the auth checks, so anonymous callers are counted by IP. A refusal is a typed `DomainError` mapped once in [domain-errors.ts](../../apps/web/src/server/trpc/domain-errors.ts). Guides: [how-to-configure-workspaces.md](../guides/how-to-configure-workspaces.md), [how-to-use-the-audit-log.md](../guides/how-to-use-the-audit-log.md).

## An MCP tool call

```mermaid
sequenceDiagram
  accTitle: An MCP tool call, create_note
  accDescr: The MCP client posts a JSON-RPC tool call to /mcp with its bearer token. The endpoint counts the request per IP, verifies the JWT against the in-process key set (issuer, audience /mcp, sub and azp), reloads the user from D1, counts the request per user, then checks in parallel that the browser session that granted the token (starter_session_id) is still valid and that the user's consent for this client is not newer than the token. Any failure answers 401 invalid_token. The tool runs in its own span and calls the same tRPC procedure in process through appRouter.createCaller, so the rate limit, actor, permission, use case, audit event and errors are the web app's. The result wraps user data in untrusted-data tags.
  participant C as MCP client
  participant M as /mcp
  participant L as Rate Limiting
  participant D as D1
  participant T as Tool create_note
  participant R as notes.create procedure
  C->>M: POST tools/call, Bearer JWT
  M->>L: mcp.ip
  Note over M: verify JWT with the in-process JWKS
  M->>D: findUserById(sub)
  M->>L: mcp.user
  par session binding
    M->>D: getSecurityState(starter_session_id)
  and consent
    M->>D: hasAgentGrant(user, azp, iat)
  end
  alt any check fails
    M-->>C: 401 invalid_token
  end
  M->>T: tool call, in a tool span
  T->>R: appRouter.createCaller(context)
  Note over R: same chain and use case as the web app
  R->>D: createNote, audit event
  R-->>T: result or tRPC error
  T-->>C: result in untrusted-data tags
```

The endpoint is [mcp/handler.ts](../../apps/web/src/server/mcp/handler.ts), the tools [mcp/tools.ts](../../apps/web/src/server/mcp/tools.ts) and [mcp/server.ts](../../apps/web/src/server/mcp/server.ts). The token comes from Better Auth's OAuth server (`/.well-known/*`, `/sign-in`, `/consent`); `mcp/parity.test.ts` keeps every procedure reachable as a tool. Guides: [how-to-setup-mcp.md](../guides/how-to-setup-mcp.md), [how-to-configure-account-security.md](../guides/how-to-configure-account-security.md).

## A background job

```mermaid
sequenceDiagram
  accTitle: A background job, from enqueue to the dead-letter queue
  accDescr: A use case calls enqueueJob, which validates the payload and sends a CloudEvents envelope, carrying the caller's traceparent, user, workspace and an optional idempotency key, through the JobQueue port to APP_QUEUE. The queue delivers batches to the Worker's queue handler. For each message the consumer parses the envelope, continues the producer's trace and, if the job has an idempotency key, claims it in D1; a key already done is acked as skipped. It runs the handler, a use case. Success marks the key done and acks. A transient failure releases the claim and retries with the job's backoff. A permanent failure is reported and acked. A failure on the final attempt is reported and moved to the dead-letter queue, which has no consumer and keeps messages 14 days.
  participant U as Use case
  participant J as enqueueJob
  participant Q as APP_QUEUE
  participant C as queue() consumer
  participant D as D1
  participant H as Job handler
  participant X as Dead-letter queue
  U->>J: enqueueJob(job, payload, context)
  J->>Q: CloudEvents envelope, traceparent, idempotencykey
  Q->>C: batch of up to 10 messages
  Note over C: parse envelope, continue the trace
  C->>D: claim the idempotency key
  alt key already done
    C-->>Q: ack, skipped
  end
  C->>H: run(deps, payload)
  alt success
    C->>D: mark key done for 7 days
    C-->>Q: ack
  else transient failure
    C->>D: release the claim
    C-->>Q: retry after the job's backoff
  else permanent failure
    C-->>Q: report, ack
  else final attempt fails
    C-->>Q: report, retry once more
    Q->>X: kept 14 days, no consumer
  end
```

The producer side is [jobs/enqueue-job.ts](../../packages/features/src/jobs/enqueue-job.ts), the consumer [server/queue.ts](../../apps/web/src/server/queue.ts) with [jobs/run-job.ts](../../packages/features/src/jobs/run-job.ts), and every job type is in [job-catalog.ts](../../packages/features/src/job-catalog.ts). Retries are `max_retries` 5 in `wrangler.jsonc`; permanent means a malformed envelope, an unknown type, an invalid payload or a `DomainError` of kind invalid_input, forbidden or not_found. Guide: [how-to-add-background-jobs.md](../guides/how-to-add-background-jobs.md).

## A cron run

```mermaid
sequenceDiagram
  accTitle: A cron run
  accDescr: A Cron Trigger from triggers.crons in wrangler.jsonc fires the Worker's scheduled handler with the schedule. The handler finds every cron catalog entry with that schedule, and runs each in a new trace and its own span. Each entry enqueues jobs, so the queue does the work. A failing entry is reported and the others still run; the run then fails. The run's metrics are flushed at the end.
  participant T as Cron Trigger
  participant S as scheduled()
  participant E as Cron catalog entry
  participant Q as APP_QUEUE
  T->>S: controller.cron, scheduledTime
  Note over S: cronEntriesFor(catalog, cron)
  loop each entry with this schedule
    Note over S: new trace, span cron name
    S->>E: run(deps, scheduledTime)
    E->>Q: enqueueJob(...)
  end
  alt an entry failed
    S-->>T: report, rethrow, run fails
  end
```

The handler is [server/cron.ts](../../apps/web/src/server/cron.ts), the entries [cron-catalog.ts](../../packages/features/src/cron-catalog.ts). Three schedules exist: hourly at minute 17 (`files.retry-cleanup`, `privacy.purge-exports`), daily at 03:17 UTC (audit, idempotency-key, notification and trash purges, trial expiry, storage reconciliation) and 08:00 UTC (`notifications.plan-digests`). `test/architecture/jobs.test.ts` keeps `triggers.crons` equal to the catalog's schedules. Guide: [how-to-add-background-jobs.md](../guides/how-to-add-background-jobs.md).

## Sign-up to the dashboard

```mermaid
sequenceDiagram
  accTitle: Sign-up, verification, workspace and dashboard
  accDescr: The sign-up form posts to /api/auth/sign-up/email with a Turnstile token. The route counts the request per IP (auth.ip), then Better Auth's before hook verifies the token with Turnstile Siteverify and applies Better Auth's own limit, stored in D1. The user.create.before hook checks the sign-up policy. Better Auth inserts the user. The user.create.after hook provisions the workspace (a personal workspace, or membership of the single workspace), starts the plan's trial, records the audit events and tracks auth.signed_up. Better Auth sends the verification mail through Email Sending. With verification required there is no session yet and the form shows check your inbox. The link verifies the address, signs the user in and lands on /email-verified, which continues to /app. The dashboard's tRPC queries resolve the actor; resolveActor provisions the workspace again if the sign-up hook failed.
  participant B as Browser
  participant A as /api/auth
  participant T as Turnstile
  participant D as D1
  participant E as Email Sending
  participant W as /app SPA
  B->>A: POST sign-up/email, Turnstile token
  Note over A: rate limit auth.ip
  A->>T: Siteverify
  A->>D: Better Auth limiter
  Note over A: user.create.before: sign-up policy
  A->>D: insert user and account
  A->>D: user.create.after: provisionUser, trial, audit
  A->>E: verification mail
  A-->>B: no session, check your inbox
  B->>A: GET verify-email link
  A->>D: email verified, session created
  A-->>B: 302 /email-verified, then /app
  B->>W: /app/dashboard
  W->>D: tRPC queries, resolveActor
```

The flow lives in [server/auth.ts](../../apps/web/src/server/auth.ts) (hooks), [workspaces/provision-user.ts](../../packages/features/src/workspaces/provision-user.ts) and the forms in `apps/web/src/components/auth/`. Without `AUTH_REQUIRE_EMAIL_VERIFICATION`, sign-up returns a session at once and the mail is still sent when email is configured. A failed provisioning is reported and does not fail the sign-up. Guides: [how-to-setup-auth.md](../guides/how-to-setup-auth.md), [how-to-configure-workspaces.md](../guides/how-to-configure-workspaces.md), [how-to-configure-abuse-protection.md](../guides/how-to-configure-abuse-protection.md).
