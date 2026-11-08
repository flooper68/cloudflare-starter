# Changelog

What changed in each release of the starter, for people evaluating it or building a product on it. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Read it on the docs site at `/docs/changelog/`; how entries are added and releases cut is in [processes/development.md](docs/processes/development.md#changelog).

## [Unreleased]

### Added

- **Automated QA against production, with no human.** A QA suite (`bun run test:qa -- --base-url <url>`) signs up, verifies by mail and erases real accounts on a deployed app; it runs after every production deploy and by hand, and a nightly job erases what aborted runs left. Mail to `*@qa.flooper.me` lands in a small inbox Worker of its own (`bun run setup:qa-inbox`), and with the new `QA_BYPASS` setting a request with the `QA_TOKEN` secret skips Turnstile, and only Turnstile, for those addresses; everyone else still gets the human check. Before deploying this, store `QA_TOKEN` on every environment with `QA_BYPASS=on` (production and develop ship it on; `bun run setup:secrets --env <env>`) or set it to `off`, and add `QA_BYPASS=off` to an existing `apps/web/.dev.vars`: without them the Worker refuses every request.
- **Settings › Connected agents.** People see every AI agent (MCP client) they allowed, with what it may do and the browser that approved it, and disconnect one with a confirmation: its tokens and consent are deleted, its access token stops working at once and it must ask again. Agents get `list_connected_agents` and `disconnect_agent`, admins see a user's agents read-only, and the audit log records `mcp.client.authorized` and `mcp.client.revoked`. The consent page now points there to revoke access.
- **Command palette in the app.** ⌘K (Ctrl+K), or **Search** in the top bar, opens a search-and-jump palette (full screen on phones): every page you may open, your workspace's notes by title or body, workspace switching in multi mode, and actions (new note, invite member, theme, docs, changelog, sign out). The sidebar, top bar titles and palette now share one navigation list, and a feature adds its own search group with a provider ([how-to-add-a-feature.md](docs/guides/how-to-add-a-feature.md#navigation-and-the-command-palette)).

### Changed

- **The starter has its own brand.** The mock brand Acme is replaced by Starter ("Everything a new app needs on day one."): a deep teal accent that passes WCAG AA as text and on buttons in both themes, a stacked-layers logo mark and favicon, Instrument Sans with JetBrains Mono (self-hosted), and 8px corners. Notification emails show the app's name as a header. A new project still replaces it in `packages/ui/src/brand/` ([how-to-define-branding.md](docs/guides/how-to-define-branding.md)).

### Fixed

- **No more blocked Web Analytics beacon on zones with automatic setup.** Every HTML response now sends `Cache-Control: no-transform` (merged into its existing value, without adding `public`), so Cloudflare's edge no longer injects its beacon into the app's pages when the zone has Web Analytics automatic setup on for other sites. Before, the Content Security Policy blocked it on every page view, with a console error and a `csp.violation` log. HTML is no longer compressed at the edge as a result ([how-to-configure-security-headers.md](docs/guides/how-to-configure-security-headers.md#edge-injected-web-analytics)).
- **The landing page loads its styles and scripts again on Cloudflare.** The deployed `/` carried two Content-Security-Policy headers, the page's and the static assets' one that loads nothing, because Cloudflare does not apply `_headers` rules in file order. Each static path now gets exactly one policy from rules that never overlap; a new file in `apps/web/public/` needs its path in `STATIC_ASSET_PATHS` ([how-to-configure-security-headers.md](docs/guides/how-to-configure-security-headers.md#static-assets)).

## [0.1.0] - 2026-11-08

The first release: a Cloudflare-first SaaS starter with auth, workspaces, billing, an admin portal and an MCP server, built, tested and documented.

### Added

- **One Worker for everything.** Astro 7 and React 19 on Cloudflare Workers serve the public pages, a client-routed app under `/app`, the tRPC and REST API, `/mcp`, the queue consumer and Cron Triggers from one deploy. Data lives in D1 through Drizzle, with SQL migrations applied by Wrangler.
- **Sign-in.** Better Auth with email and password and/or Google, each switched per environment; optional email verification with "Check your inbox" (rate-limited resend) and "Email verified" screens; password reset by email.
- **Two-factor and passkeys.** Authenticator codes with recovery codes, optional emailed codes, passkey sign-in, and an enrollment policy per environment (off, optional, required for admins, required). Destructive admin actions ask for a fresh second factor.
- **Account and workspace settings.** Profile and avatar, verified email changes, linked accounts, your own sessions, locale, time zone and theme, workspace name and logo, and confirmed workspace and account deletion.
- **Workspaces and roles.** Data belongs to workspaces; personal, single or multi-workspace mode; open or invite-only sign-up with a domain allowlist and a bootstrap admin; invitations by email; roles from one permission map; a members page and a workspace switcher.
- **Plans and limits.** A plan catalog in code (plans, add-ons, gated features, usage limits), trials with a daily expiry, usage meters, upgrade prompts where a limit stops someone, and `BILLING=off`, `manual` or `provider` with a port for your own payment adapter (no payment SDK is bundled).
- **Admin portal.** For platform admins (`ADMIN_PORTAL`): users (search, suspend, sign out, reset password or second factor, change role, erase), impersonation, workspace rescue and deletion, plan overrides, data requests, storage maintenance, the audit log, feature flags, a health card, a D1 overview and read-only settings.
- **MCP server.** Claude connects to `/mcp` with OAuth and acts as the signed-in user, with a consent page that lists the scopes in plain words. Every API has an MCP tool or a written exemption, checked by a test.
- **Notifications.** A typed catalog, an in-app inbox with an unread badge, email at once or as a daily digest, preferences per type and channel, security notices that cannot be turned off, and one-click unsubscribe (RFC 8058).
- **Email.** Cloudflare Email Service through the `send_email` binding, simulated in local development, behind a port you can swap.
- **Files and trash.** Uploads to R2 through the Worker or straight to R2 with presigned URLs; deleted files and notes can be restored from a workspace trash for 30 days before a daily purge; optional reconciliation (`STORAGE_RECONCILE`) reports or removes orphaned R2 objects.
- **Privacy: exports and erasure.** Personal and workspace ZIP exports built by a background job and downloaded through expiring signed links; self-service and admin account erasure through one pipeline; a data catalog every table must join.
- **Background jobs and crons.** Typed jobs on Cloudflare Queues with exponential backoff, idempotency keys and a dead-letter queue kept 14 days; a cron catalog checked against `wrangler.jsonc`.
- **Audit log.** Append-only events for sign-in, sign-up, password changes and admin and workspace actions, each with the request's trace id, purged after a retention period.
- **Observability.** OpenTelemetry-shaped logs, error reports, metrics and spans on one trace id, written to Workers Logs and Analytics Engine; users see a reference instead of a stack trace.
- **Product analytics.** A typed event catalog written to Analytics Engine under pseudonymous user and workspace ids, with no personal data in events, and an optional cookieless Cloudflare Web Analytics beacon.
- **Feature flags.** OpenFeature-shaped flags defined in code, with workspace, plan and percentage rules stored in D1, read with `useFlag`/`FlagGate` in the app and managed by admins.
- **Health endpoints.** `/health/live` and `/health/ready` for uptime monitors and status pages, in the IETF health check format, with D1, R2, binding and settings checks.
- **Placeholder apps.** Notes, a small real feature built end to end (tables, permissions, a plan limit, trash, audit and product events, API, MCP tools, screens and tests), as the worked example of the "add a feature" guide; and Tasks, a sample board and list with no backend. Both are marked as placeholders for a project to replace.
- **Starter dashboard and system screens.** A getting-started checklist (verify email, invite a teammate, two-factor, first note), the developer demos at `/app/demos`, an in-app 404, a 403 that names who can grant access, and an offline notice.
- **Docs site.** The repository's own Markdown published at `/docs`, with navigation, "On this page", edit links, search (Pagefind, built at deploy time), page descriptions, a sitemap when the build knows the site's address (`SITE_URL`, set for production), and these release notes with an Atom feed.
- **Landing page.** A prerendered page at `/` describing the starter, with links to the docs, GitHub, Storybook, sign-in and the app.
- **Component library.** Over 100 components and patterns in a dense, dark-first visual language, themed by tokens and re-branded in two files, with Storybook at `/_storybook/`.
- **Tests at every layer.** Domain and integration tests on real local D1 and R2, API tests through tRPC and `/mcp`, every Storybook story as an accessibility-checked component test, Playwright journeys, and architecture tests that enforce the structure.
- **Production smoke suite and QA checklist.** `bun run test:smoke` checks a deployed environment with read-only requests, and the deploy workflow runs it after every deploy; a scripted checklist covers what needs an account.
- **Setup and operations.** Setup scripts for Cloudflare resources, secrets, auth, admins, analytics, email and storage, `bun run doctor`, CI with a dry-run deploy per environment, and optional self-hosted CI runners in Docker.

### Changed

- `/` is the starter's landing page for everyone; it no longer redirects signed-in visitors to the dashboard. "Open app" in its header goes to the app.
- The upload, queue and email demos moved from the home page to `/app/demos`.
- `AUTH_EMAIL_PASSWORD` and `AUTH_REQUIRE_EMAIL_VERIFICATION` are required settings with no default: the Worker refuses to start, naming the setting, until each environment sets them.

### Fixed

- A user whose workspace was not created at sign-up gets their personal workspace on their next request instead of an error.
- Links in the app keep their token colours in the light theme, and the date picker's selected preset is readable.

### Security

- Security headers after the OWASP Secure Headers Project on every response, and a Content-Security-Policy on every page that runs only the app's own scripts, with violation reports and an enforce or report-only mode.
- Rate limits on every mutation, auth endpoint, upload and `/mcp`, and Cloudflare Turnstile on sign-up, sign-in and password reset.
- MCP access is bound to the browser session that granted it: signing that session out revokes the agent.
- Pages whose URL carries a token (invitations, password reset, unsubscribe) never load the Web Analytics beacon.
- Dependency advisories resolved by updates and exact overrides; every remaining accepted advisory has a documented reason.

[Unreleased]: https://github.com/flooper68/cloudflare-starter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/flooper68/cloudflare-starter/releases/tag/v0.1.0
