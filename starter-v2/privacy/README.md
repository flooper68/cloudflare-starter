# Privacy UI evidence — 31 October 2026

All current captures use the complete combined snapshot in an isolated combined implementation checkout, Chromium at http://localhost:4793, a 1440×1080 viewport, synthetic identities/files and local D1/R2/Queues/Email simulation. Turnstile remained enabled using the approved development-only deterministic harness. No real account, email, remote resource or deployment was changed. Every screenshot waits for finite CSS animations to settle.

## Public selection

Only files listed in `public-evidence-files.txt` are intended as attachments. The selection contains 42 screenshots, the completed walkthrough, the inspected synthetic ZIP, and sanitized result JSON/JSONL. Do not publish scripts, raw logs, or the `private-videos` directory. No session-state or admin-credential fixture was copied into this directory: the scripts read existing test fixtures in their original checkout location.

## Screenshots

- `before-user-privacy-{dark,light}.png`: copied from the earlier settings feature baseline, before the export feature.
- `user-empty-real-{dark,light}.png`: the existing synthetic shared user has no export requests.
- `user-{loading,error,queued,building,ready,failed,expired}-fixture-{dark,light}.png`: explicit browser response fixtures cover every list state without changing server records. Failed-state evidence asserts internal fixture failure details are not displayed.
- `admin-loaded-real-{dark,light}.png`: actual local export metadata and erasure records.
- `admin-{loading,error,empty}-fixture-{dark,light}.png`: controlled list responses. Empty shows both no exports and no erasures.
- `admin-erasure-confirmation-real-{dark,light}.png`: actual confirmation control for a synthetic admin's own id.
- `admin-erasure-refusal-real-{dark,light}.png`: actual backend refusal `CANNOT_ERASE_SELF_AS_ADMIN`, directing the admin to account settings.
- `personal-export-{requested,ready}-real-{dark,light}.png`: actual queue request and published archive.
- `export-notification-real-{dark,light}.png`: actual delivered completion notification.
- `self-erasure-confirmation-real-{dark,light}.png`, `self-erasure-complete-real-{dark,light}.png`, `erased-account-sign-in-refused-real-{dark,light}.png`: actual synthetic account erasure and rejected subsequent sign-in.

Representative ready, failed, admin confirmation/refusal and completed-flow images were visually inspected. Password fields remain masked. Signed download query strings are absent from all selected textual results; captures show the app viewport, not browser chrome or request traces.

## Real walkthrough and archive

`export-notification-download-self-erase.webm` records a synthetic account signing up, requesting its export, receiving the completion notification, downloading through that notification and deleting its own account. An actual file containing only `Synthetic privacy export evidence.` was uploaded before export.

`synthetic-personal-export.zip` is the actual downloaded archive. Python zipfile validated CRCs, manifest format 1, safe NDJSON credential-column exclusions and the exact synthetic uploaded file bytes. It has 12 entries. `archive-inspection.json` lists the entries, record counts and SHA-256. All identities/content in it are synthetic test data.

The recorded request is `940aaea7-baf0-4c95-b942-f8e0d6828b18`. `request-sanitized.json`, `download-sanitized.json` and `erasure-sanitized.json` contain only selected metadata. After erasure, the old signed download returned 404; account settings redirected to sign-in, and the old credentials were refused. No signed query, cookie, session token or password is serialized in these results.

`job-results-sanitized.json` is an allowlisted extraction from the actual local queue completion log: the final privacy.build-export finished on attempt 1. Raw logs remain private. `api-mcp-results-sanitized.jsonl` contains actual privacy API and registered MCP-tool executor results from real local D1/R2 tests; the download result retains its path and expiry while removing its query before serialization. These are tool-executor integration results, not a claim of a newly registered external MCP client.

## Authorization and test provenance

Real D1/R2 tests cover a workspace owner being permitted, a member being refused, missing/cross-user subjects and invalid/expired downloads. The focused capture run passed five tests. Browser admin self-erasure refusal is real; deterministic state screenshots do not replace authorization tests.

The full combined component suite passed 1,042 tests in both themes (188 files plus two pre-existing utility skips). Full combined E2E passed 28/28 after the notification routing and test-isolation corrections. The auth journey verifies the Privacy-page ZIP and downloads through both the inbox and bell are byte-identical, then self-erases.

## QA findings and corrections

The original E2E opened the inbox before queued completion delivery and assumed live refresh. It now waits for real delivery by reopening the inbox and retaining the visible-link assertion; each reload allows the asynchronous list render to settle. Clicking an export notification originally entered the SPA's Page not found route. A focused safe-URL helper now reserves SPA navigation for same-origin app/admin paths, uses native HTTP(S) document navigation for downloads and rejects unsafe schemes before rendering anchors. Both inbox and bell are covered by actual browser download events.

Reconciliation's extra sign-ins could consume another spec's shared per-IP quota. That spec now uses a separate documentation-range client IP, as the existing security spec already does. Real limits and dedicated rate-limit assertions were retained.

Automatic approval review rejected a proposed copy of browser-session/admin fixture files into the evidence directory. No copy ran. The capture scripts were changed to read the original synthetic fixtures in place and write only sanitized evidence; the safer approach completed without additional user approval.
