# How to record the walkthrough videos

The home page and the docs show short videos of the app at work: walkthroughs of 30 to 90 seconds with chapters and captions, and muted loops of 6 to 10 seconds in the home page's cards. They are recorded by script from the app itself, so they are re-recorded with one command whenever the UI changes, and served by the app from R2, so no Content-Security-Policy changes. Use when you re-record the videos after a UI change, script a new video, upload videos to an environment, put a video on a page or in a doc, or a video does not play.

## Overview

| Step      | Command or file                             | What happens                                                                                                                                                     |
| --------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue | `apps/web/src/content/videos.ts`            | Every video: id, title, kind (`walkthrough` or `loop`), status (`scripted` or `planned`), which UI work in flight it shows, and the home page's slots            |
| Script    | `apps/web/media/videos/<id>.ts`             | One Playwright script per scripted video: the storyboard's steps, each with a chapter title and a caption                                                        |
| Record    | `bun run media:record [--only <id>[,<id>]]` | Seeds a fresh local app, records each script, encodes the files into `apps/web/tmp/media/out/<hash>/` (gitignored) and updates `src/content/media-manifest.json` |
| Upload    | `bun run media:upload --env <env>`          | Puts each video's folder into the environment's FILES bucket under `media/<hash>/`, skipping folders already there                                               |
| Serve     | `apps/web/src/pages/media/[...path].ts`     | The Worker streams `/media/<hash>/<file>` from R2: byte ranges, a year of immutable caching, the type from the extension                                         |
| Show      | `VideoPlayer.astro`, the docs' `::video`    | The player on a page, or in a doc                                                                                                                                |

Only `media-manifest.json` is committed: the media itself is never in git. Each video's files are named by a content hash, so a re-recorded video gets a new folder, the old one keeps serving until the new manifest is deployed, and cached copies never go stale.

## Requirements

- **Bun and the app's local setup**: `apps/web/.dev.vars` from `.dev.vars.example` ([run it locally](../start/run-locally.md)). The recordings assume the example's settings: `WORKSPACE_MODE=multi`, `BILLING=manual`, `ADMIN_PORTAL=on`, `TWO_FACTOR=optional`.
- **Playwright's Chromium** (`bunx playwright install chromium` in `apps/web`), as for the E2E tests.
- **ffmpeg and ffprobe**, a development requirement for the full output (`brew install ffmpeg`, `apt-get install ffmpeg`). Without them the recorder still runs, keeps Playwright's own WebM (untrimmed, VP8, larger) and no MP4, and says so; the entry records `"encoder": "playwright"`. In CI, or with `--require-ffmpeg`, it stops instead. Safari plays only the MP4, so record with ffmpeg before you upload.
- **The port of `APP_URL` must be free**: the recorder starts its own `astro dev` there (Better Auth trusts only that origin). Stop your dev server first.

## Record

```bash
bun run media:record                    # every scripted video, about 15 minutes
bun run media:record --only agents      # one, or a comma-separated list
```

The recorder:

1. Applies the migrations to a fresh state in `apps/web/tmp/media/state-seed` and starts `astro dev` on it (`MEDIA_STATE_DIR`, read by `astro.config.mjs`). Your own `.wrangler/state` is never read or written.
2. Seeds it with the shared demo world through the app itself ([seed data](#seed-data)), then stops.
3. For each video: copies the seeded state, starts `astro dev` on the copy, opens every page once so nothing compiles on camera, and runs the script in Chromium at 1440 × 900 (loops at 1120 × 700), dark theme, with Playwright's video recording on.
4. Encodes: cuts the lead-in before step 1, writes H.264 MP4 (played first, everywhere) and VP9 WebM without a sound track, loops scaled to 960 px wide; the poster is a screenshot without the cursor (`d.poster()` in the script, else the last frame); walkthroughs get WebVTT captions from the step captions.
5. Writes each video's files and its manifest entry (`<id>.json`) to `apps/web/tmp/media/out/<hash>/`, merges the entries into `src/content/media-manifest.json` and prints each video's length and sizes. A step that started later than its storyboard time is listed as a warning.

Review the files in `apps/web/tmp/media/out/`, then commit the manifest with the change that needed the re-recording.

### Seed data

The videos show the same world as the docs screenshots: the shared demo seed, `apps/web/test/seed/demo.ts` (`DEMO`, `seedDemo`), also used by `bun run docs:screenshots`. Ada Lovelace (`ada@demo.test`, the platform admin) owns "Acme (sample)" with its notes, a comment, a file and a note in the trash; Grace Hopper is a member and Alan Turing is invited. The recorder runs it with `seedDemo(page, { agent: false, persistTo })`: no agent is connected beforehand, because the videos connect "Demo MCP client" on camera, and Ada's admin role is written to the recorder's own state (`bun run setup:admin --persist-to`). What a video creates live is `LIVE` in `apps/web/media/lib/seed.ts`: the agent's note "Call Marta about invoice" and the invitation to `katherine@demo.test`. To change what the videos and screenshots show, change `DEMO`, then record and capture again. Every password is a local test value; nothing here is a real account.

## Write a video script

1. Add the video to `VIDEOS` in `apps/web/src/content/videos.ts` with `status: "scripted"`, and to `HOME_CLIPS` or a doc if it has a place.
2. Write `apps/web/media/videos/<id>.ts` exporting a `VideoScript` and add it to `SCRIPTS` in `media/videos/index.ts`. `media/media.test.ts` fails when the scripts and the catalogue disagree.
3. Drive the page with the `Director` (`media/lib/director.ts`), never with Playwright's instant actions, so the video looks like a person using the app:

| Call                                                                        | What it does                                                                                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d.step(at, title, caption)`                                                | A storyboard step: waits until `at` seconds into the video, then starts a chapter with that caption. The first step starts the video; everything before it is cut |
| `d.click(locator)`                                                          | Moves the visible cursor along an eased path, pauses, clicks                                                                                                      |
| `d.type(locator, text)`                                                     | Clicks the field and types at a steady, slightly uneven pace                                                                                                      |
| `d.moveToLocator(locator)`, `d.moveTo(x, y)`, `d.scroll(dy)`, `d.pause(ms)` | Point at something, scroll, hold                                                                                                                                  |
| `d.agentSays(line)`, `d.showConsole()`, `d.hideConsole()`                   | The "agent console" panel listing the MCP calls of the script's agent (`media/lib/agent.ts`)                                                                      |
| `d.poster()`                                                                | This moment, without the cursor, is the poster                                                                                                                    |
| `d.end(at)`                                                                 | Holds the last frame until `at` seconds: the video's length                                                                                                       |

The cursor and the agent console are drawn by the recorder (`media/lib/overlay.ts`, injected into the recording's pages only), never by the app. Walkthroughs are 30 to 90 seconds and loops 6 to 10 (`media.test.ts` checks the manifest). Keep a caption short enough to read in its step.

## Upload

```bash
bun run media:upload --env local                       # the local R2 of bun run dev:web
bun run media:upload --env local --persist-to <dir>    # another local state
bun run media:upload --env production --dry-run        # print the commands only
bun run media:upload --env production                  # staging and develop the same way
```

It reads the manifest, and for each video checks the bucket for its `media/<hash>/<id>.json`: present means the folder is complete and it is skipped; otherwise it puts the media files, then the JSON last, with `wrangler r2 object put` (`--remote --env <env>`, the bucket bound as `FILES` in `wrangler.jsonc`). The files come from `apps/web/tmp/media/out/`, so upload from the machine (or CI run) that recorded them. Remote uploads use your Wrangler login, or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Upload before you deploy the manifest that names the videos; a page whose media is not in R2 yet shows the poster's designed stand-in.

The `media/` prefix of the FILES bucket holds only these public videos: storage reconciliation scans `workspaces/` and `users/` only, and no export or erasure touches it ([storage reference](../reference/storage.md#walkthrough-videos)).

## In CI

`.github/workflows/media.yml`, **Actions → Walkthrough videos → Run workflow** (optionally with ids to record), by hand only:

1. **Record** on a runner with ffmpeg, no secrets; the files are the run's `walkthrough-videos` artifact.
2. **Upload** to production R2 in the GitHub environment `production`, with the deploy workflow's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` ([how-to-setup-ci.md](how-to-setup-ci.md)); its protection rules apply.
3. **Pull request** with the new `media-manifest.json` on a branch `media/re-record-<run>`; merge it and deploy to show the videos.

Setup the workflow needs from the owner:

- Settings › Actions › General › Workflow permissions: allow GitHub Actions to create pull requests.
- A pull request opened with the workflow's own token does not start other workflows, so the required checks never run on it. Add a fine-grained token with Contents and Pull requests write on this repository as the secret `MEDIA_PR_TOKEN`, or push an empty commit to the branch to start CI.

## The player

`apps/web/src/components/media/`, board `VideoPlayer` of the design canvas:

| Kind        | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Walkthrough | The poster with a Play button named by title and length, tags for length, "Captions on" and "No sound". Nothing loads until Play or a chapter is pressed; then the native controls (pause, seek, captions, full screen) take over, captions are on, and the current chapter is marked (`aria-current`). Chapters are buttons beside the video (under it on phones); "Read the transcript" lists every caption. Never plays on its own                                                                                                                                                                                                                                                                              |
| Loop        | Muted, plays only while half in view and pauses off screen (IntersectionObserver), with a pause button always visible. Under `prefers-reduced-motion: reduce` it shows the poster with a Play button and waits. **Play full screen** (an expand button, `cursor: zoom-in`; a click on the clip does the same) opens it large: on a touch screen native full screen (`requestFullscreen`, `webkitEnterFullscreen` on iPhone); elsewhere a `<dialog>` lightbox about 90vw wide in the clip's ratio, playing from the start with controls and a **Full screen** button, closed by Escape, the backdrop or Close with focus back on the card. Under reduced motion the lightbox waits on the poster with a Play button |
| Missing     | Not recorded yet (no manifest entry): the "Clip coming soon" poster. Recorded but not in R2: the poster's designed stand-in, and "This video is not available yet." on Play                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

The markup is `player-markup.ts`, one HTML string shared by `VideoPlayer.astro` and the docs; the behaviour is `video-player.ts`, the `<walkthrough-video>` element and the lightbox (about 2.5 KB gzip); the styles `video-player.css`. On a page:

```astro
---
import VideoPlayer from "@/components/media/VideoPlayer.astro";
---
<VideoPlayer id="agents" />
```

The home page shows `HOME_CLIPS` in the pillar cards and `HOME_WALKTHROUGH` in "Watch each part work" ([docs site reference](../reference/docs-site.md#the-landing-page)).

### In the docs

The docs kit's video directive shows a video in a doc ([how-to-publish-docs-and-landing.md](how-to-publish-docs-and-landing.md)):

```markdown
::video{id="agents" poster="connected-agents" title="Agents & MCP in 75 seconds"}
```

`id` is a video of `VIDEOS`. While the manifest has no entry for it, the doc shows the `poster` screenshot with "Video coming soon"; once it is recorded, the same player as the home page, with the manifest's title, chapters and captions (`apps/web/src/docs/kit/render.ts`), and the page loads the player's script (`src/docs/walkthroughs.ts`). The home page and the docs read one manifest, `apps/web/src/content/media-manifest.json`; a changed manifest renders every doc again. `media.test.ts` checks that every `::video` names a video of `VIDEOS`. The feature pages under `docs/features/` carry one each; `agents` plays on `/docs/features/agents/`.

### Content-Security-Policy and caching

The videos, posters and captions come from this origin, so every page policy already allows them (`media-src 'self'`, `img-src 'self'`); no policy changed. `/media/*` is not a static asset: the Worker answers it (`src/server/media.ts`) with `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges: bytes`, an ETag (`If-None-Match` gets 304), 206 for one byte range and 416 outside the file, and the non-HTML policy and security headers of every Worker response. The middleware reads no session for it. A missing file is a 404 cached for 60 seconds. Only the recorder's file types are served (`.mp4`, `.webm`, `.jpg`, `.vtt`, `.json`), and only under `media/`.

## Re-record after a UI change

Run `bun run media:record` (or `--only` the videos that show the change), check the output, upload and commit the manifest. `rerecordAfter` in `VIDEOS` names the UI work in flight each video shows:

| Change in flight            | Re-record                                                        |
| --------------------------- | ---------------------------------------------------------------- |
| The container workflow demo | `loop-job-mail`; the planned `platform` walkthrough waits for it |

The recordings run with `DEMO_MODE=off` from `.dev.vars.example`: they show the app as a project runs it, without the public demo's banner. Demo mode's sample data could replace the seed (`DEMO_SAMPLE_DATA`); the seed stays separate so the videos do not change when the demo's data does.

## Planned videos

`VIDEOS` lists the storyboarded videos that have no script yet, each with what it needs (`followUp`): `accounts` (a TOTP generator and Chrome's virtual authenticator), `workspaces` (a second browser and billing seed data), `privacy`, `platform`, `infra` (a dev-log pane) and `dx` (terminal scenes). The short clips of the plan other than the four on the home page and the consent clip are follow-ups too, as are 390 × 844 phone recordings.

## Starter only

> **Starter-only, removed by `starter:strip`** (`walkthrough-videos`): the starter's own videos (the scripts in `apps/web/media/videos/` other than `types.ts`, `scenes.ts` and `index.ts`, their entries in `VIDEOS`, `HOME_CLIPS`, `HOME_WALKTHROUGH` and `media-manifest.json`) show the starter itself; the docs' `::video` directives stay and show their posters. The strip removes them and keeps the pipeline: the recorder, the seed's structure, the upload, the `/media` route, the player and the workflow, for a project that wants walkthroughs of its own product ([how-to-start-a-project.md](how-to-start-a-project.md)).

## Common problems

### "Port … is in use"

Your dev server (or another recorder) runs on `APP_URL`'s port. Stop it and record again.

### A step "started late"

The app took longer than the storyboard allows (a cold compile, a slow job). The video is still written; re-record it, or move the step's `at`.

### The player shows the poster's stand-in and "This video is not available yet"

The manifest names a hash that is not in that environment's R2. Run `bun run media:upload --env <env>`.

### No MP4 in the manifest

ffmpeg was not found when recording (`"encoder": "playwright"`). Install it and record again.
