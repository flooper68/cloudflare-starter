# Product analytics reference

::reviewed{date="2026-11-09"}

The detail behind [the guide](../guides/how-to-setup-product-analytics.md) on product and web analytics: read it when the guide is not enough.

## What Is Wired Up

| Data                                                                                                                                     | Where it comes from                                                                                              | Where it goes                                                             | Setting                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Server events (`auth.signed_up`, `files.uploaded`, `workspaces.created`, `workspaces.member_joined`, `notes.created`) and identify calls | Use cases (`trackEvent`, `identifyUser`) and the sign-up hook                                                    | Analytics Engine dataset bound as `ANALYTICS_EVENTS`, one per environment | `ANALYTICS=analytics-engine\|none`                      |
| Client events (`app.page_viewed`, `app.command_palette_*`)                                                                               | The SPA (`trackClientEvent` in `apps/web/src/lib/analytics.ts`) → tRPC `analytics.track`                         | Same dataset                                                              | `ANALYTICS`                                             |
| Site events (`site.*`, `docs.page_viewed`, `auth.sign_up_started`, `auth.sign_up_failed`)                                                | The public pages (`trackSiteEvent` in `apps/web/src/lib/site-analytics.ts`) → `POST /api/site-events`, anonymous | Same dataset, no user or workspace                                        | `ANALYTICS`                                             |
| Funnel milestones (`app.feature_tried`, `app.session_returned`)                                                                          | The tRPC middleware, the auth hook, `/api/files` and the `/app` page, once per person (`analytics_milestones`)   | Same dataset                                                              | `ANALYTICS`                                             |
| Page views, referrers, Web Vitals                                                                                                        | Cloudflare's beacon in every page (`apps/web/src/components/WebAnalytics.astro`)                                 | Cloudflare Web Analytics (dashboard)                                      | `WEB_ANALYTICS=cloudflare\|none`, `WEB_ANALYTICS_TOKEN` |
| The funnel, read back                                                                                                                    | Admin › Analytics (`/admin/analytics`), `admin_get_analytics`                                                    | The SQL API and GraphQL Analytics API, read with `ANALYTICS_READ_TOKEN`   | `ANALYTICS_READ_TOKEN`, `ANALYTICS_ACCOUNT_ID`          |

The port is `ProductAnalytics` (`packages/features/src/platform/ports/product-analytics.ts`): `track(event, context)` and `identify(context, traits)`, synchronous and never throwing. Adapters: `analytics-engine` (`platform/adapters/cloudflare/analytics-engine-product-analytics.ts`), `noop` (`ANALYTICS=none`) and `memory` (tests). `buildPlatform(env)` (`apps/web/src/server/platform.ts`) picks one; `platform.productAnalytics()` gives a fresh instance per unit of work, because Analytics Engine accepts 250 data points per invocation and each instance counts its own.

## Setting Up An Environment

The settings are not shipped in `apps/web/wrangler.jsonc`: whether an environment collects analytics is the owner's decision, so the Worker refuses to start (500 naming the setting) until it is made.

1. `bun run setup:analytics --env <env>` (try `--dry-run` first) asks for `ANALYTICS`, `WEB_ANALYTICS` and, with `WEB_ANALYTICS=cloudflare`, `WEB_ANALYTICS_TOKEN`, and writes them into that environment's `vars` in `wrangler.jsonc`.
2. With `ANALYTICS=analytics-engine`: `bun run setup:secrets --env <env>` stores `ANALYTICS_ID_SECRET`; type a key the first time (`openssl rand -base64 32`), later runs keep it when you press Enter (locally an empty value generates one). Keep it: rotating it starts every pseudonymous id afresh, so old and new data no longer join.
3. Nothing to create for Analytics Engine: the dataset (`cloudflare_starter_<env>_product_events` in `wrangler.jsonc`) appears on its first write. For Web Analytics, add the site in the dashboard first ([Web Analytics](#web-analytics)).
4. `bun run doctor` checks the settings; deploy.

| Setting                                            | Kind                                  | Values                          | Needs                                                                                                       |
| -------------------------------------------------- | ------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ANALYTICS`                                        | var                                   | `analytics-engine`, `none`      | `analytics-engine`: the `ANALYTICS_EVENTS` binding and `ANALYTICS_ID_SECRET`                                |
| `ANALYTICS_ID_SECRET`                              | secret                                | 32+ characters                  | the HMAC key of the pseudonymous user and workspace ids                                                     |
| `WEB_ANALYTICS`                                    | var                                   | `cloudflare`, `none`            | `cloudflare`: `WEB_ANALYTICS_TOKEN`                                                                         |
| `WEB_ANALYTICS_TOKEN`                              | var                                   | the site token of Web Analytics | not a secret: it is in every page's HTML                                                                    |
| `ANALYTICS_EVENTS`                                 | binding (`analytics_engine_datasets`) | one dataset per environment     | declared in all three environments (`test/architecture/product-analytics.test.ts`)                          |
| `ANALYTICS_READ_TOKEN`                             | secret, optional                      | an account API token            | permission Account › Account Analytics › Read, this account only; the admin Analytics page only             |
| `ANALYTICS_ACCOUNT_ID`                             | secret, optional                      | 32 hex characters               | the account the token reads                                                                                 |
| `ANALYTICS_EVENTS_DATASET`, `METRICS_DATASET_NAME` | var                                   | the bindings' dataset names     | in `wrangler.jsonc` per environment, equal to the bindings' (`test/architecture/product-analytics.test.ts`) |
| `WEB_ANALYTICS_SITE_TAG`                           | var, optional                         | 32 hex characters               | adds Web Analytics visits and referrers to the Analytics page                                               |

Locally `.dev.vars` (from `.dev.vars.example`) sets `ANALYTICS=analytics-engine` with a local `ANALYTICS_ID_SECRET` and `WEB_ANALYTICS=none`. Wrangler simulates the dataset: writes are accepted and nothing is stored, so locally you see events only in tests. The API tests pin the same values in `apps/web/test/api-bindings.ts`.

## The Event Catalog

Every event is declared once, in the feature that owns it, and registered in one composition root:

| Event                                              | Declared in                                    | Properties (slot order)                                                                                                   | Sent by                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.signed_up`                                   | `accounts/domain/analytics-events.ts`          | `method`, `provider`                                                                                                      | Better Auth's `user.create.after` hook (`server/auth-audit.ts`)                                                                                                                                                                                |
| `files.uploaded`                                   | `files/domain/analytics-events.ts`             | `content_category`; `size_bytes`                                                                                          | `storeFile` (`POST /api/files`)                                                                                                                                                                                                                |
| `workspaces.created`                               | `workspaces/domain/analytics-events.ts`        | `kind`                                                                                                                    | `createWorkspace`, `provisionUser` (a personal workspace, or the single-mode app workspace on the first sign-up)                                                                                                                               |
| `workspaces.member_joined`                         | `workspaces/domain/analytics-events.ts`        | `role`, `via`                                                                                                             | `acceptInvitation`, `provisionUser` (single mode)                                                                                                                                                                                              |
| `notes.created`                                    | `notes/domain/analytics-events.ts`             | `length` (empty, short, long; never the text)                                                                             | `createNote` (the placeholder Notes app)                                                                                                                                                                                                       |
| `container_runs.started`                           | `container-runs/domain/analytics-events.ts`    | `digits` (1000, 10000, 50000), `kind` (new, retry)                                                                        | `startContainerRun` (the container workflow demo)                                                                                                                                                                                              |
| `app.page_viewed` (client)                         | `product-analytics/domain/analytics-events.ts` | `route` (the route pattern, never the URL)                                                                                | the SPA, on every resolved route                                                                                                                                                                                                               |
| `app.command_palette_opened` (client)              | `product-analytics/domain/analytics-events.ts` | `source` (shortcut or trigger)                                                                                            | the app's command palette, when it opens                                                                                                                                                                                                       |
| `app.command_palette_item_selected` (client)       | `product-analytics/domain/analytics-events.ts` | `kind` (navigate, note, workspace, action; never the query or the item)                                                   | the app's command palette, when an item is picked                                                                                                                                                                                              |
| `auth.sign_up_started` (site)                      | `accounts/domain/analytics-events.ts`          | `method` (password, google)                                                                                               | the sign-up page, when a valid form is submitted or Google chosen                                                                                                                                                                              |
| `auth.sign_up_failed` (site)                       | `accounts/domain/analytics-events.ts`          | `reason` (invalid, bot_check, exists, not_allowed, rate_limited, error)                                                   | the sign-up page, when the attempt failed; never the address                                                                                                                                                                                   |
| `app.feature_tried`                                | `product-analytics/domain/feature-trials.ts`   | `feature` (`TRIED_FEATURES`)                                                                                              | once per person and feature: the triggers in [The funnel](#the-funnel)                                                                                                                                                                         |
| `app.session_returned`                             | `product-analytics/domain/feature-trials.ts`   | `days_since_sign_up`                                                                                                      | once per person: the first `/app` page load on a later UTC day than the sign-up (`server/return-visit.ts`)                                                                                                                                     |
| `site.page_viewed` (site)                          | `product-analytics/domain/site-events.ts`      | `page`, `entry`, `referrer_host`, `utm_source`                                                                            | every public page with site events, on load                                                                                                                                                                                                    |
| `site.page_scrolled` (site)                        | `product-analytics/domain/site-events.ts`      | `page`; `depth` (25, 50, 75, 100)                                                                                         | each quarter mark, once per page view                                                                                                                                                                                                          |
| `site.page_engaged` (site)                         | `product-analytics/domain/site-events.ts`      | `page`, `signal` (scrolled, video, feature_map, docs, cta), `entry`                                                       | the first sign of interest of a page view (scrolled past half, a video, the feature map, a docs page, a click on a call to action)                                                                                                             |
| `site.cta_clicked` (site)                          | `product-analytics/domain/site-events.ts`      | `cta`, `placement` (ids from `data-track-cta`, `data-track-placement`), `entry`, `repeat` (the view's first click or not) | a click on an element with `data-track-cta`                                                                                                                                                                                                    |
| `site.video_played`, `site.video_completed` (site) | `product-analytics/domain/site-events.ts`      | `video` (the video's id in `src/content/videos.ts`)                                                                       | Play pressed on a walkthrough or loop (once per view), a walkthrough played to the end                                                                                                                                                         |
| `site.feature_map_used` (site)                     | `product-analytics/domain/site-events.ts`      | `action` (select, filter)                                                                                                 | the landing page's feature map (`components/site/feature-map.ts`)                                                                                                                                                                              |
| `docs.page_viewed` (site)                          | `product-analytics/domain/site-events.ts`      | `section` (`guides`, `reference`, `home`; never the path)                                                                 | every docs page                                                                                                                                                                                                                                |
| `$identify`                                        | `product-analytics/domain/identify-traits.ts`  | `role`, `workspace_size`, `plan`                                                                                          | `identifyMember` after a workspace is created (and its plan started) or joined; `plan` is the plan in effect from billing (`BillingGate.planId`: the trial or subscription plan, the default plan without one, `unlimited` with `BILLING=off`) |

The catalog is `analyticsEvents` in [packages/features/src/analytics-events.ts](../../packages/features/src/analytics-events.ts).

### Adding an event

1. Declare it in the owning feature's `domain/analytics-events.ts`:

   ```ts
   export const invoicePaidEvent = defineEvent(
     "billing.invoice_paid",
     { strings: ["plan", "currency"], numbers: ["amount_cents"] },
     z.object({
       plan: z.enum(PLANS),
       currency: z.string().length(3),
       amount_cents: z.number().int().nonnegative(),
     }).strict(),
     { client: false, description: "An invoice was paid" }
   );
   ```

2. Register it in `analytics-events.ts`.
3. Server event: call `trackEvent(deps, context, invoicePaidEvent, { … })` in the use case, after the change succeeded, with the use case's `analytics` dependency (tRPC procedures pass `ctx`, which carries it). Client event (`client: true`): call `trackClientEvent("billing.checkout_opened", { … })` in the SPA, the name a string literal. Site event (`site: true`, a public page, anonymous): `trackSiteEvent("site.pricing_viewed", { … })` from `src/lib/site-analytics.ts`.
4. Test: the use case's integration test asserts the event with the memory adapter (`useCaseDeps().analytics.recorded`); a client event's schema gets a domain test.

### Rules (enforced)

- **Names** are `<feature>.<object>_<past-tense verb>` in lowercase snake case, at most 64 characters (`eventDefinitionProblems`, `product-analytics/domain/event-rules.ts`).
- **Properties** are strings (enums, buckets, route patterns) or numbers, listed in the layout in a fixed order: at most 14 string and 20 numeric properties. A property is only ever appended, never moved or reused for another meaning, because the order is the stored column (see [Data-point layout](#data-point-layout)).
- **No personal data.** A property name that matches `/email|e_?mail|phone|name$|first|last|address|ip|user_?id|ssn|birth|password|token|lat|lng|location/i` fails the build; rename the property (or drop it), there is no exemption list. Values are categories, counts and buckets, never free text from the user. Who did something travels only as the pseudonymous user and workspace keys.
- **Every declared event is registered and tracked, every tracked, client-sent or site-sent name is in the catalog** (`test/architecture/product-analytics.test.ts`); client events must be `client: true`, site events `site: true` (never both), and server events neither.
- `POST /api/site-events` accepts a batch of 1 to 10 `site: true` events (one bad event refuses the batch, 400), same-origin only (403), `text/plain` or `application/json` (415), at most 8 KiB (413), limited by `site.events` (60 a minute per IP, binding `RL_SITE_EVENTS`). It never reads the session cookie and writes no user or workspace; requests from crawlers and automated browsers (`NON_HUMAN_AGENT`) are answered 204 and not counted.
- **Only `product-analytics/` and the platform call the port**; features use `trackEvent` and `identifyUser`.
- `analytics.track` accepts a batch of 1 to 20 `client: true` events whose properties pass the event's schema; one bad event refuses the batch (`BAD_REQUEST`, `INVALID_ANALYTICS_EVENT`). It is a workspace procedure (events carry the caller's current workspace), limited by `analytics.client` (120 a minute per user, binding `RL_ANALYTICS`), not by `mutation.user`, and has no MCP tool: client telemetry is not an agent capability (`MCP_EXEMPT_PROCEDURES`).

Review checklist 2 asks for the same ([code-review.md](../processes/code-review.md#2-security-and-auth)): no personal data in analytics events.

## Segment Spec Mapping

The port follows the [Segment spec](https://segment.com/docs/connections/spec/), so another vendor's adapter is a mapping, not a redesign.

| Segment                                    | Here                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `track(event, properties)`                 | `ProductAnalytics.track({ event, properties, layout }, context)`; features call `trackEvent`                                               |
| `identify(userId, traits)`                 | `ProductAnalytics.identify(context, { traits, layout })`; features call `identifyUser` / `identifyMember`; stored as the `$identify` event |
| `group(groupId, traits)`                   | not a call of its own: every event carries the workspace (`context.workspaceId`), Segment's `groupId`                                      |
| `page` / `screen`                          | the client event `app.page_viewed`; full page analytics come from Web Analytics                                                            |
| `userId`                                   | `context.userId`, pseudonymized by the adapter (`HMAC-SHA256(ANALYTICS_ID_SECRET, id)`, 32 hex)                                            |
| `anonymousId`                              | none: events of anonymous callers carry no user                                                                                            |
| `context.app.version`, `context`           | `context.release` (the deployed version id), `context.environment`, `context.source` (`http`, `queue`, `cron`)                             |
| `timestamp`                                | set by Analytics Engine when the point is written                                                                                          |
| Event naming ("Object Action", title case) | lowercase `<feature>.<object>_<verb>` like job types; an adapter for a Segment-style tool may title-case names                             |
| `alias`                                    | not used                                                                                                                                   |

## Site Events

The public pages (the landing page, the docs, the auth pages without a token in their URL) send their own events, because Web Analytics cannot say whether a visitor scrolled, played a video or clicked a call to action. `SiteEvents.astro` (in `PublicLayout.astro` and `Layout.astro`) renders `<meta name="app-site-events" content="/api/site-events" data-page="…">` and the script, only with `ANALYTICS=analytics-engine` (prerendered pages decide at build time). `startSiteAnalytics()` then sends:

| What                                 | Event                                         | How                                                                                                                                       |
| ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The page view and where it came from | `site.page_viewed`                            | `entry=yes` when the referrer is another site; then its host and `utm_source` only                                                        |
| How far down the page                | `site.page_scrolled`                          | 25, 50, 75 and 100 %, once each per view                                                                                                  |
| Got the pitch                        | `site.page_engaged`                           | once per view, at the first of: scrolled past half, a video, the feature map, a docs page                                                 |
| A call to action                     | `site.cta_clicked`                            | any element with `data-track-cta="<id>"` and `data-track-placement="<id>"`                                                                |
| Videos                               | `site.video_played`, `site.video_completed`   | the walkthrough player (`components/media/video-player.ts`): Play pressed, played to the end; a loop that plays on its own counts nothing |
| Docs read                            | `docs.page_viewed`                            | the section only                                                                                                                          |
| Sign-up attempts                     | `auth.sign_up_started`, `auth.sign_up_failed` | `SignUpForm.tsx`, with the failure's category                                                                                             |

Events are batched (10, or after 1 s, at once when a link is followed or the page is hidden) and sent with `navigator.sendBeacon`. No cookie is set or read, nothing is stored in the browser, and there is no visitor id: every page view stands alone, so the public steps of the funnel count events, not people. Automated browsers (`navigator.webdriver`: the QA, E2E and smoke suites) send nothing. The landing page's own calls to action are `demo`, `github` and `copy_prompt` at `hero`, `closing`, `header`, `menu` and `start`.

## The Funnel

| Step                     | Counts                                                                                | From                                             |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Visits                   | entry page views (no visitor id: a visit is a view whose referrer is not this site)   | `site.page_viewed` with `entry=yes`              |
| Got the pitch            | entry views with a sign of interest, at most one each                                 | `site.page_engaged` with `entry=yes`             |
| Clicked a call to action | entry views with a click (a click is also interest), at most one each                 | `site.cta_clicked` with `entry=yes`, `repeat=no` |
| Started sign-up          | sign-up attempts: a valid form submitted or Google chosen, once per sign-up page view | `auth.sign_up_started`                           |
| Signed up                | people who signed up in the period (the cohort)                                       | `auth.signed_up`                                 |
| Tried a feature          | people of the cohort with a first try                                                 | `app.feature_tried`                              |
| Tried 3+ features        | people of the cohort with three or more                                               | `app.feature_tried`                              |
| Came back within 7 days  | people of the cohort back on a later day, at most 7 days after sign-up                | `app.session_returned`                           |

Each step carries its share of the step above (`share`, `withShares`), never more than 100 %: the three visit steps are nested (every click is also interest), and where the unit changes (visits to attempts to people) a larger count shows as 100 %. Later pages of a visit (a docs reader's fourth page) count in the breakdowns, not in the funnel.

`TRIED_FEATURES` (`product-analytics/domain/feature-trials.ts`) lists what a person can try: notes, files, workspaces, invitations, agents (MCP), the command palette, notification settings, the jobs and email demos, data export, the trash, passkeys, two-factor and the container workflow demo. The triggers: a successful mutation in `FEATURE_TRIAL_PROCEDURES` (from the app or an MCP tool; any MCP call also counts as `agents`), the client event `app.command_palette_opened`, the auth endpoints in `FEATURE_TRIAL_AUTH_PATHS` (a passkey added, two-factor on, an agent allowed on the consent page) and the first `POST /api/files`. `recordFeatureTried` inserts `(user, feature)` into `analytics_milestones` (`ON CONFLICT DO NOTHING`) and sends the event only when the row is new; an isolate remembers what it saw, so a person's tenth note costs no query. A failed write logs `product_analytics.milestone_failed` and never fails the request.

## Who Is Left Out

`productAnalyticsFor(env, who)` (`apps/web/src/server/analytics-audience.ts`) gives the noop adapter, so nothing is written and no milestone recorded, for: the `BOOTSTRAP_ADMIN_EMAIL`, sessions an admin is impersonating, and in the starter's own instance the QA suite's accounts (`@QA_EMAIL_DOMAIN`) and demo mode's protected accounts (`DEMO_PROTECTED_EMAILS`). Site events have no account: automated browsers send nothing and the endpoint drops crawlers' and headless browsers' requests.

## The Analytics Page

Admin › Analytics (`/admin/analytics?days=1|7|30`, `AdminAnalyticsPage.tsx`) and the MCP tool `admin_get_analytics` call `admin.analytics.get`, an `adminProcedure` (the admin role and the portal's second-factor rules; NOT_FOUND for everyone else). `getAnalyticsReport` (`product-analytics/get-analytics-report.ts`) runs three SQL statements (`reportQueries`, `product-analytics/domain/analytics-report.ts`) with `ANALYTICS_READ_TOKEN` against `ANALYTICS_EVENTS_DATASET` and `METRICS_DATASET_NAME`, and with `WEB_ANALYTICS_SITE_TAG` one GraphQL query (`rumPageloadEventsAdaptiveGroups`: visits, page views, referrers, countries); nothing is stored. Without the token, the account or the dataset name the answer is `{ status: "not_configured", missing }` and the page names the settings. A refused token or a failed events query is `PRECONDITION_FAILED` (`ANALYTICS_UNAVAILABLE`) with Cloudflare's reason; a failing route or Web Analytics part becomes a note.

| Part                         | Query                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site steps and breakdowns    | the site events of the period by event and properties, `SUM(_sample_interval)`                                                                                                           |
| People steps                 | `auth.signed_up`, `app.feature_tried`, `app.session_returned` by person (`blob2`), `min(timestamp)`; the first try, time to it, depth and return are worked out per person in the Worker |
| Errors and latency per route | `http.server.request.duration` of the metrics dataset by route and status: requests, 5xx, mean and slowest                                                                               |

Each query returns at most 10,000 rows (`ROW_LIMIT`); the page says when the period had more. Referrer hosts and campaign names come from visitors: the MCP tool returns them, like every result, between `<untrusted-data>` tags.

## Privacy And Erasure

- **Pseudonymous ids.** User and workspace ids leave the app only as `HMAC-SHA256(ANALYTICS_ID_SECRET, id)`, cut to 32 hex characters (`pseudonymousId`). The same id always gives the same key, so funnels and retention work, and without the secret a key cannot be turned back into an id. Raw ids are never written (the adapter's test checks it).
- **No personal data** in properties (see the rules), no IP address, no user agent, no URL with ids or query strings. Site events carry no id at all: no cookie, no browser storage, no visitor or session id; the referrer is reduced to its host.
- **Funnel milestones.** `analytics_milestones` holds which milestones a person reached and when (a feature id or `returned`, a timestamp), so each funnel event is sent once. It is personal data of the account: in the data catalog (`DATA_CATALOG`), exported with the account, and deleted with it (`ON DELETE CASCADE`).
- **Retention.** Analytics Engine keeps every data point for **3 months**, then drops it; the app stores no copy (the Analytics page reads live).
- **Erasure.** Analytics Engine cannot delete individual rows. When a user is deleted, the app keeps no link from them to their key: the key exists only as an HMAC of an id that no longer exists in the database, and their data points age out with Analytics Engine's retention, **3 months**. A GDPR erasure request is therefore answered by deleting the account; the analytics data cannot be tied back to the person and is gone within 3 months. (Recomputing a key needs both `ANALYTICS_ID_SECRET` and the deleted user's id; the audit log still names that id until its own retention, [how-to-use-the-audit-log.md](../guides/how-to-use-the-audit-log.md).) If a project needs immediate erasure, rotating `ANALYTICS_ID_SECRET` cuts every link at once (at the cost of continuity), or it uses a vendor whose adapter can delete by user.
- **Web Analytics** is cookieless: the beacon sets no cookies and keeps no local storage, collects page views, referrers and performance timings, and does not log query strings ([Cloudflare's announcement](https://blog.cloudflare.com/free-privacy-first-analytics-for-a-better-web/), [FAQ](https://developers.cloudflare.com/web-analytics/faq/)).
- With `ANALYTICS=none` and `WEB_ANALYTICS=none` nothing is collected at all.

## Data-Point Layout

One `writeDataPoint` per event, not awaited (the runtime sends it after the response). `ANALYTICS_ENGINE_FIXED_BLOBS` and `toAnalyticsEngineDataPoint` in the adapter are the source of truth.

| Column                          | Holds                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `index1`                        | event name (the sampling key)                                                            |
| `blob1`                         | event name                                                                               |
| `blob2`                         | pseudonymous user key, `''` when anonymous                                               |
| `blob3`                         | pseudonymous workspace key, `''` when none                                               |
| `blob4`                         | environment (`develop`, `staging`, `production`)                                         |
| `blob5`                         | release (the Worker version id)                                                          |
| `blob6`                         | source (`http`, `queue`, `cron`)                                                         |
| `blob7`..`blob20`               | the event's string properties in catalog order (`null` stored as `''`, cut to 256 bytes) |
| `double1`..`double20`           | the event's numeric properties in catalog order                                          |
| `timestamp`, `_sample_interval` | set by Analytics Engine                                                                  |

So for `files.uploaded`, `blob7` is `content_category` and `double1` is `size_bytes`; for `$identify`, `blob7` is `role`, `blob8` `workspace_size`, `blob9` `plan`. `decodeAnalyticsEngineDataPoint(point, layout)` reads a point back with names (tests use it).

Limits ([Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)): 20 blobs of at most 16 KB together, 20 doubles, one index of at most 96 bytes, 250 data points per invocation, 3 months of retention. The catalog rules keep every event inside them; the adapter drops (and logs `product_analytics.dropped` as a warning) anything that is not, and everything past 250 in one unit of work. Analytics never fails or slows the request.

## Sampling

Analytics Engine samples when one index value gets many writes, and again at query time over long ranges ([sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)). The index is the event name, so rare events keep all their points and frequent ones (`app.page_viewed`) are sampled first. Each row carries `_sample_interval` (100 means the row stands for 100 points); always weight by it:

| You want   | Write                                                     |
| ---------- | --------------------------------------------------------- |
| a count    | `SUM(_sample_interval)`, not `count()`                    |
| a sum      | `SUM(double1 * _sample_interval)`                         |
| a mean     | `SUM(double1 * _sample_interval) / SUM(_sample_interval)` |
| a quantile | `quantileExactWeighted(0.5)(double1, _sample_interval)`   |

Distinct counts of non-index columns (`COUNT(DISTINCT blob2)`, active users) are estimates under sampling: fine for trends, not for billing.

## Querying Outside The App

The admin portal reads the funnel ([The Analytics page](#the-analytics-page)); for anything else, query the dataset yourself. Create an API token with **Account Analytics Read** in the Cloudflare dashboard (the same permission `ANALYTICS_READ_TOKEN` has) and keep it outside the repository.

**SQL API:**

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql" \
  --header "Authorization: Bearer $ANALYTICS_READ_TOKEN" \
  --data "SELECT blob1 AS event, SUM(_sample_interval) AS events
          FROM cloudflare_starter_production_product_events
          WHERE timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY event ORDER BY events DESC"
```

More queries (replace the dataset name per environment):

```sql
-- Sign-ups per day, by method
SELECT toStartOfDay(timestamp) AS day, blob7 AS method, SUM(_sample_interval) AS sign_ups
FROM cloudflare_starter_production_product_events
WHERE index1 = 'auth.signed_up' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, method ORDER BY day;

-- Uploads and bytes per content category, and the median size
SELECT blob7 AS content_category,
       SUM(_sample_interval) AS uploads,
       SUM(double1 * _sample_interval) AS bytes,
       quantileExactWeighted(0.5)(double1, _sample_interval) AS median_bytes
FROM cloudflare_starter_production_product_events
WHERE index1 = 'files.uploaded' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY content_category ORDER BY uploads DESC;

-- Weekly active users and workspaces (estimates under sampling)
SELECT toStartOfWeek(timestamp) AS week,
       COUNT(DISTINCT blob2) AS active_users,
       COUNT(DISTINCT blob3) AS active_workspaces
FROM cloudflare_starter_production_product_events
WHERE blob2 != '' AND timestamp > NOW() - INTERVAL '90' DAY
GROUP BY week ORDER BY week;

-- Most viewed SPA pages
SELECT blob7 AS route, SUM(_sample_interval) AS views
FROM cloudflare_starter_production_product_events
WHERE index1 = 'app.page_viewed' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY route ORDER BY views DESC;

-- Workspaces by size bucket (latest identify per workspace)
SELECT size, COUNT() AS workspaces FROM (
  SELECT blob3 AS workspace, argMax(blob8, timestamp) AS size
  FROM cloudflare_starter_production_product_events
  WHERE index1 = '$identify' GROUP BY workspace
) GROUP BY size;
```

**Grafana** ([Cloudflare's guide](https://developers.cloudflare.com/analytics/analytics-engine/grafana/)): add the Altinity ClickHouse data source (`vertamedia-clickhouse-datasource`) with URL `https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql`, all built-in auth off, and a custom header `Authorization: Bearer <token>`. Set `Column:DateTime` to `timestamp` to use the `$timeSeries` and `$timeFilter` macros:

```sql
SELECT $timeSeries AS t, blob1 AS event, SUM(_sample_interval) AS events
FROM cloudflare_starter_production_product_events
WHERE $timeFilter
GROUP BY event, t ORDER BY t
```

The metrics dataset of the observability work (`METRICS_DATASET`) is a separate dataset with its own layout; do not mix the two in one query.

## Web Analytics

[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) counts page views and Web Vitals with a small script and no cookies. With `WEB_ANALYTICS=cloudflare` every page (`Layout.astro` and the SPA shell `pages/app/[...path].astro`) ends with

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token":"<WEB_ANALYTICS_TOKEN>","spa":false}'></script>
```

(`"spa":true` in the SPA shell, so client-side route changes count as page views). With `none` there is no script at all. Pages whose URL carries a credential, `/invite/<token>`, `/reset-password?token=…` and `/unsubscribe?t=…`, never load it (`<Layout analytics={false}>`); `test/architecture/web-analytics.test.ts` fails when a page with a `[token]` segment or a `t`/`token` query parameter renders the beacon.

Setup: Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → the environment's hostname → copy the token from the JS snippet → `bun run setup:analytics --env <env>`. Cloudflare's automatic setup (the dashboard injecting the beacon at the edge) is not used: every HTML response says `Cache-Control: no-transform`, so the edge injects nothing even when the zone has automatic setup on for other sites, and the policy of pages rendered per request would block an injected beacon anyway (the prerendered pages would run it; [Edge-injected Web Analytics](security-headers.md#edge-injected-web-analytics)). The beacon reports to `https://cloudflareinsights.com/cdn-cgi/rum`; the policy of pages rendered per request allows exactly `script-src https://static.cloudflareinsights.com/beacon.min.js` and `connect-src https://cloudflareinsights.com/cdn-cgi/rum` only with `WEB_ANALYTICS=cloudflare`, never the whole origins; the prerendered pages always allow those two URLs, in `_headers` and in Astro's `<meta>` policy (`astro.config.mjs`). A source with a path matches only that URL, so an edge-injected beacon (`/beacon.min.js/v…`) or any other script of the origin stays blocked (`test/e2e-build/analytics.spec.ts`). Ad blockers may block it; Web Analytics numbers are a floor.

## Another Vendor (PostHog, Amplitude)

A vendor is a new adapter of the `ProductAnalytics` port and a new value of `ANALYTICS`, not a change to callers ([overview.md#ports-and-adapters](../architecture/overview.md#ports-and-adapters)). Neither is shipped. Sketches:

```ts
// platform/adapters/posthog/posthog-product-analytics.ts (bun add posthog-node in packages/features)
export function createPostHogProductAnalytics(options: {
  client: PostHog;
  idSecret: string;
  waitUntil: (p: Promise<unknown>) => void;
}): ProductAnalytics {
  const budget = createPointBudget();
  return {
    track(event, context) {
      if (undeliverableReason(event.event, event.layout) || !budget.take())
        return;
      options.client.capture({
        distinctId:
          pseudonymousId(options.idSecret, context.userId) || "anonymous",
        event: event.event,
        properties: {
          ...event.properties,
          environment: context.environment,
          release: context.release,
        },
        groups: context.workspaceId
          ? { workspace: pseudonymousId(options.idSecret, context.workspaceId) }
          : undefined,
      });
    },
    identify(context, { traits }) {
      if (context.userId)
        options.client.identify({
          distinctId: pseudonymousId(options.idSecret, context.userId),
          properties: traits,
        });
    },
  };
}
// Flush with options.waitUntil(client.shutdown()) at the end of the request; never await in track.
```

Amplitude is the same shape over its HTTP V2 API (`POST https://api2.amplitude.com/2/httpapi` with `user_id`, `event_type`, `event_properties`, `groups`), batched per unit of work and sent with `waitUntil`. Either way: keep the pseudonymous ids (the vendor then cannot erase by real user either; or send raw ids and use the vendor's deletion API in the account-deletion flow), add the vendor's host to a CSP if a browser SDK is used (prefer server-side), add the setting value in `apps/web/src/lib/config.ts`, a branch in `buildPlatform`, a contract test, and a row in this guide. Both are cookie-free only when used server-side like this.

## Troubleshooting

| Symptom                                                            | Cause and fix                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every request answers 500 naming `ANALYTICS` or `WEB_ANALYTICS`    | The environment has no choice yet: `bun run setup:analytics --env <env>`, deploy                                                                                                                               |
| 500 naming `ANALYTICS_ID_SECRET`                                   | `ANALYTICS=analytics-engine` without the secret (or shorter than 32): `bun run setup:secrets --env <env>`                                                                                                      |
| 500 naming `ANALYTICS_EVENTS`                                      | The binding is missing from that environment in `wrangler.jsonc`                                                                                                                                               |
| `product_analytics.dropped` warnings in the logs                   | An event over the limits or more than 250 points in one request; `app.analytics.reason` says which                                                                                                             |
| `analytics.track` answers 400 `INVALID_ANALYTICS_EVENT`            | The SPA sent an event that is not `client: true` in the catalog, or properties its schema rejects                                                                                                              |
| `analytics.track` answers 429                                      | More than 120 batches a minute from one user (`analytics.client`); the SPA batches, so look for a loop                                                                                                         |
| No rows in the dataset                                             | Locally nothing is stored (simulation). Deployed: check `ANALYTICS=analytics-engine`, and that the query names `cloudflare_starter_<env>_product_events`; rows appear within a minute                          |
| Admin › Analytics says "Analytics are not connected"               | Set the settings it names: `ANALYTICS_READ_TOKEN` and `ANALYTICS_ACCOUNT_ID` with `bun run setup:secrets --env <env>`, `ANALYTICS_EVENTS_DATASET` in `wrangler.jsonc`                                          |
| Admin › Analytics answers "Cloudflare refused the analytics token" | The token lacks Account › Account Analytics › Read on this account, or was revoked: create one, `setup:secrets`                                                                                                |
| The funnel's public steps stay at 0                                | `ANALYTICS=analytics-engine` at build time (prerendered pages), an ad blocker, or an automated browser (they send nothing by design); check `POST /api/site-events` answers 204 in the browser's network panel |
| `product_analytics.milestone_failed` warnings                      | The `analytics_milestones` table is missing in that database: apply `0000_init`'s `CREATE TABLE analytics_milestones` ([how-to-setup-d1.md](../guides/how-to-setup-d1.md))                                     |
| Build fails: property "…" looks like personal data                 | Rename the property (`signup_email_domain` → `signup_domain_category`), or drop it                                                                                                                             |
