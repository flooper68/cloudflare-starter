# Starter v2 review evidence

Selected evidence for the billing, settings, trash/storage, security and privacy changes prepared on 31 October 2026. [Feature index](FEATURES.md) maps the review units to screenshots, walkthroughs and captured results.

All demonstrations use synthetic accounts/files and isolated local Cloudflare simulations. Test emails were captured locally. The records distinguish actual application requests/jobs from controlled browser fixtures used to exercise loading, error, empty and alternate-mode states. No artifact claims a real Google/hardware ceremony, remote restoration or deployment.

The integrated implementation passed `bun run verify` (329 files / 2,572 tests), component tests (1,042 tests; two pre-existing utility files skipped), all 28 browser journeys, build, migration consistency and develop/staging/production packaging dry runs. The PR verification record remains the authority for the exact commit and latest CI status. Existing tooling-dependency advisories are documented separately and are not represented as a clean audit.

Only explicitly selected files were copied. Credentials, browser storage/session JSON, account fixture files, raw logs, reproduction scripts and unfiltered video directories are excluded. Two invitation-token arguments were redacted from the wave-one MCP result copy. Security setup keys/QR seeds/recovery codes are masked in screenshots. The synthetic privacy ZIP was checked for safe entry paths, valid JSON/NDJSON and absence of credential values.

[MANIFEST.json](MANIFEST.json) records hashes, sizes and source-relative provenance for the selected artifacts. [SANITIZATION.json](SANITIZATION.json) records the publication redactions. [FILES.txt](FILES.txt) is the final publication allowlist. Keep this directory on the evidence branch, separate from application source history.
