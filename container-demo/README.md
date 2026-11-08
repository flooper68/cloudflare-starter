# Container workflow demo: evidence

Branch `feat/container-workflow-demo`. Produced locally on 2026-11-08 with `astro dev` (`apps/web`, port 4417, develop vars: `CONTAINER_DEMO=on`, `CONTAINER_DEMO_RUNNER=fake`, cap 50), Playwright Chromium at 1280×900 (and 375×812 for the phone shot), signed in as the E2E shared user (`test-results/.auth/user.json`). The Workflow runs in Miniflare; the fake container computes pi in the Worker with a 600 ms stand-in for container start-up.

| File | What |
| --- | --- |
| `01-demos-{dark,light}.png` | Developer demos with the new Containers card ("Run a workflow") |
| `02-page-{dark,light}.png` | The page before a run (runs left today and this hour), with past runs |
| `03-running-{dark,light}.png` | A run in progress: the live step timeline with timings. The light one also shows the hourly-limit state ("You started the most runs allowed in an hour", Start run disabled) after the earlier runs |
| `04-succeeded-{dark,light}.png` | A finished run: every step done with its time, run duration, compute time, size, the first 100 digits and the download |
| `05-phone-light.png` | The page at phone width |
| `run-walkthrough.gif` / `.webm` | Recording of one run (dark): demos → page → pick 50,000 → Start → steps → result |

Failed-run, off and cap-reached states are covered by the Storybook stories `Patterns/Containers/ContainerRunTimeline` (Failed, RetryAndOpen, RetryDisabled) and by `apps/web/test/api/container-runs.test.ts` (off, daily cap, hourly limit, a failed run and its retry, the MCP tools).
