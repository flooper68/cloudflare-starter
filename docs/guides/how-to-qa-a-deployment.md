# How to QA a deployment

::reviewed{date="2026-11-09"}

A deployment is checked with no human: the production smoke suite looks at what a signed-out visitor sees, and the automated QA suite walks every feature with real accounts and the app's real mail. Use this guide to run the suite, read a failure, or do the two checks only a person can do.

> **Starter-only, removed by `starter:strip`** (`qa-automation`): the automated QA suite, its workflow and `QA_BYPASS=on` exist for the starter's own production. A project keeps the smoke suite.

::flow[Deploy -> Smoke suite -> QA suite -> Cleanup]{title="Release checks: after a deploy the smoke suite runs, then the QA suite, which erases its own accounts"}

| Layer            | What                                                                       | Run                                                          |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Browser journeys | Every critical journey against a local dev server                          | `bun run test:e2e`, in CI on every pull request              |
| Production smoke | Pages, redirects, endpoints, headers, accessibility, signed out, read-only | `bun run test:smoke -- --env production`, after every deploy |
| QA suite         | Every feature with real accounts and real mail, then erases them           | `bun run test:qa -- --env production`, after the smoke suite |

## The automated suite

It covers sign-up and verification, sign-in, password reset, two-factor, passkeys, workspaces and invitations, files, billing, notifications, settings, trash, privacy exports, the admin portal, agents over MCP, Notes and Tasks, the dashboard, the command palette, the demos, and every main screen in both themes at desktop and phone width. Each section is one journey; what each checks: [the checklist](../../apps/web/test/qa/README.md#the-checklist).

:::prompt{title="Paste this into your coding agent"}
```text
Run the QA suite against production (`bun run test:qa -- --env production`; I will paste
QA_TOKEN when you ask). If a journey fails, open its trace, tell me which step failed,
the reference shown in the error, and whether it is the app or the test.
```
:::

:::byhand
```bash
QA_TOKEN=… bun run test:qa -- --env production
```

`QA_TOKEN` is the production Worker secret of the same name. Without it every journey skips (CI fails instead). Or run **Actions › QA › Run workflow**: the Deploy workflow already runs it after a production deploy.
:::

## Read a failure

:::steps
1. **Open the report:** `apps/web/playwright-report/qa` locally, or the `qa-report-<run id>` artifact of the workflow run.
2. **Find the failed step** in the journey's trace: the screenshot, the network calls and the page at that moment.
3. **Take the reference** shown in the error (or the `x-request-id` of the failed call) and search Workers Logs for that `trace_id`.
4. **Decide:** a bug in the app gets a fix and a test; a flaky step in the journey gets a fix in `apps/web/test/qa/`. Never retry until green.
   :::

:::gotcha{title="Production is shared and limited per IP"}
One journey at a time, no retries: sign-up allows 5 a minute, sign-in 10 a minute, account erasure 3 an hour. Start a run at least a minute after the previous one ended.
:::

## Checks only a person can do

- **A real Turnstile challenge:** open `/sign-up` in a normal browser; the widget appears and passes (or shows a challenge you solve), and a sign-up with a non-QA address works.
- **A real phone passkey:** add a passkey from a phone (the cross-device QR) and sign in with it.
- **Mail delivery:** the weekly delivery check sends a real mail to the owner's inbox; look that it arrived, not in spam.

## Reference

How a run works (accounts, passwords, the QA outbox, the bypass, the QA admin, cleanup), CI and its schedules, writing a journey, the checklist section by section, the run record and keeping it current: [the QA suite's README](../../apps/web/test/qa/README.md).
