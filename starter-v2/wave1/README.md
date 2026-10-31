# Wave 1 review evidence — 31 October 2026

All screenshots and recordings use the isolated local app at http://localhost:4783, Chromium, a 1440×1080 viewport, synthetic test accounts and local D1/R2/Queues. TURNSTILE remained on; the approved E2E development-only Siteverify transport and browser widget fixture were used. No owner account, remote data, real OAuth, deployment or shipped default changed.

## Selected artifacts

`public-evidence-files.txt` is the attachment/upload allowlist: 80 PNGs, three named walkthroughs, actual MCP/job result JSON records, actual local job response/audit JSON and the sidebar color comparison. **Do not publish the session JSON files, admin-accounts.json, raw server logs, or the unfiltered videos directory**; those are local reproduction support, not selected evidence.

- `before-profile-{dark,light}.png`: original HEAD Profile components, before the settings implementation.
- `before-billing-app-and-trial-banner-{dark,light}.png`: original app shell without billing/trial UI.
- `before-admin-billing-{dark,light}.png`: original admin workspace page before its billing panel.
- `settings-account-{filled,error,loading}-*.png`, `settings-security-{error,loading}-*.png`, `settings-workspace-{error,loading,empty}-*.png`: completes the earlier settings evidence. Account error/loading are the requested missing light cases. Supplemental feature-stage filled states are under [settings/](settings/).
- `billing-app-filled-*`, `billing-app-and-trial-{error,loading}-*`, `billing-app-off-*`, `trial-banner-{ending,off}-*`, `billing-admin-{filled,error,loading,off}-*`: actual app pages and banner, including absent/off behavior.
- `trash-{empty,filled,member,error,loading,delete-confirm,empty-confirm,undo-toast,restored}-*`: all trash states in both themes, after the missing top-bar title was fixed.
- `reconciliation-{off,error,loading,report-queued}-*`: default-off mode and actual report submission.
- `reconciliation-delete-{enabled-fixture,confirm,failure-fixture}-*`: controlled delete-mode UI states.
- `reconciliation-delete-{enabled-real,confirm-real,queued-real}-*`: a separate real local deletion-mode run.
- `trash-walkthrough.webm`: actual upload → trash → undo → trash → restore flow and confirmation review.
- `reconciliation-report-walkthrough.webm`: actual admin report submission.
- `reconciliation-real-delete-walkthrough.webm`: actual confirmed local deletion-mode job.

## Actual API/MCP/job results

`mcp-and-job-results.jsonl` contains 29 captured JSON records emitted by local integration tests; the two invitation-token argument values are redacted in this publication copy: MCP tools/call envelopes and results (including list_trash, restore_from_trash, purge, empty, storage status/report and disabled-delete refusal), plus real D1/R2 reconciliation handler results. Console instrumentation was temporary and restored; it is absent from the source delta. The capture run passed 13 tests.

`real-report-response.json` is the real browser-submitted default-off report request response. `real-delete-response.json` and `real-delete-audit.json` prove a real confirmed deletion-mode job: run `1d8fb5b3-1459-4517-a4fc-ffeeae9da099`, job `36437acf-2d02-4bc8-a9d9-921e98d6494e`. Both workspaces/ and users/ pages completed with scanned=0, orphaned=0, deleted=0. The synthetic file used for trash evidence was purged before this run. Only the ignored local .dev.vars was temporarily set to delete; it is restored to off.

## Fixture provenance

Loaded pages and the trash/report/real-delete walkthroughs use actual local data. Browser-only response overrides create loading/error/empty/read-only/off/near-expiry states; they preserve other entries in tRPC batches. They do not mutate server configuration. `billing-app-off` and `billing-admin-off` change only the page's bootstrap fixture; the app's conditional UI follows it. Reconciliation delete success/failure UI cases are independently covered by E2E response fixtures; the separate real-delete evidence exercises the actual queue consumer.

Before views temporarily loaded original HEAD components (and original styles) in the isolated checkout. Every source file was restored in finally; no baseline source remains in the final diff. Repository E2E tests reproduce the application flows; capture scripts and private fixtures are not published.

## Theme timing and the anchor reset

The nearly invisible sidebar seen in older screenshots was caused by capturing midway through text-color transitions after changing color scheme. Every selected before/after screenshot was recaptured after finite CSS animations settled.

A separate token issue was confirmed: the unlayered anchor reset overrode link utility colors. On the steady light sidebar, Dashboard computed rgb(27,28,31) with the old reset despite its muted token; putting that reset in the base layer restores intended rgb(89,92,98), on rgb(251,251,252). Both are readable. The fix restores the existing token contract; it is not presented as a rescue from insufficient contrast. See sidebar-before-light.png, sidebar-after-light.png and sidebar-computed-colors.json.

Representative both-theme, loading, error, confirmation and real-job images were inspected. The Trash top bar now says Trash; earlier screenshots with Not found were replaced. No screenshot is an assertion that live Google OAuth or a remote deployment was tested.


## Supplemental feature-stage captures

[settings/](settings/) holds selected original settings screens, including appearance, connected accounts/sessions, workspace controls and mobile account layout. These predate the final shell token/transition correction; primary screenshots above show the corrected shell. The older light workspace-confirmation frame catches the sidebar during a theme transition; its form is readable and is not used as final sidebar-color evidence.

[settings-walkthrough.webm](settings-walkthrough.webm) is the completed profile-edit/save walkthrough (7.96 seconds), not a claim to show every settings operation. [billing-owner-walkthrough.webm](billing-owner-walkthrough.webm) and [billing-admin-walkthrough.webm](billing-admin-walkthrough.webm) are the successful 24.8/25.28-second owner/admin recordings, with their feature-stage screenshots under [billing-flow/](billing-flow/). The completed owner recording ends with the expired trial on Free; the admin recording ends after plan/limit changes. Two zero-byte failed-attempt videos were excluded.
