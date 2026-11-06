# 0003. Hash-based Content-Security-Policy built per request, headers on every response

Status: Proposed

Date: 2026-11-06

## Context

Production sent no security headers. The app renders Astro pages with React islands, loads Cloudflare Turnstile and optionally the Web Analytics beacon, PUTs presigned uploads straight to R2, and serves Storybook and other static files through Workers Static Assets, which never runs the Worker. `/api/files` serves user uploads from the app's own origin. Astro 7's built-in CSP (`security.csp`) hashes the inline code it renders and sends it in a header on server-rendered pages; it has no nonce support and does nothing under `astro dev`, which the E2E journeys run against.

## Decision

Every response the Worker serves gets the OWASP Secure Headers set from one pure module (`apps/web/src/server/security-headers.ts`), applied by the app middleware after routing, so redirects, errors and health answers are covered. HTML pages get a CSP Level 3 policy built per request: Astro's hashes are kept, everything else is replaced; scripts only from `<origin>/_astro/` and hashed inline code (no `'unsafe-inline'`, no `'unsafe-eval'`, no `'strict-dynamic'`); third-party origins only while their setting is on; `frame-ancestors 'none'`; reports to `/api/csp-report`, logged and rate limited. Non-HTML responses get a policy that loads nothing. Static assets get the same headers from `public/_headers`, generated from the module and checked by a test; Storybook has its own looser policy there. Styles libraries inject at runtime are hashed from the installed package at build. `CSP_MODE=enforce|report-only` is required with no default; the starter enforces everywhere. Under `astro dev` only `script-src` and `style-src` are relaxed; every journey fails on any violation, and a second Playwright config checks the built app.

## Consequences

A new third party, inline script or runtime-injected style is blocked until it is added deliberately; E2E and the build journeys catch it before deploy. Hash-based pages stay cacheable. Uploaded files cannot run script, and a `<script src>` pointing at an upload is refused. Storybook keeps `'unsafe-inline'` (its build has no hashes); it holds no user data. Browser extensions produce report noise. `_headers` applies only to assets, so the two delivery paths must stay in step (the generator and its test). HSTS has no `preload`; adding it is the domain owner's decision.

## Alternatives considered

- Nonces: Astro 7 cannot emit them; rewriting every `<script>` with HTMLRewriter would also bless injected markup, and nonced pages cannot be cached.
- `'strict-dynamic'`: makes `'self'` and host sources ignored, so the parser-inserted bundles and the beacon would need hashes Astro cannot give for external files.
- Astro's CSP alone: covers only `script-src` and `style-src` on pages, nothing for API answers, assets, reports or per-setting third parties.
- Report-only by default: the owner asked for an explicit setting, enforced in production.
- One shared `'self'` for scripts: would let a `<script src="/api/files/…">` run an upload.
