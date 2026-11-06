# How To Configure Security Headers (CSP, HSTS And Friends)

Every response of the web Worker carries the headers the [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/) recommends, and every HTML page a [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/) built per request: scripts only from the app's own bundles and the inline code Astro hashed at build time, third parties only when their setting is on, violations reported to `/api/csp-report`. This guide covers what is sent where, the `CSP_MODE` setting, the reports, static assets and Storybook, how to allow something new, the exceptions and why they exist, and the tests. Use when you add a third-party script, frame, font or API, add an inline script or style, see a CSP violation (in the console, an E2E failure or the logs), roll out a policy change, or consider HSTS preload.

The code: `apps/web/src/server/security-headers.ts` (the policies, pure), `apps/web/src/server/app-middleware.ts` (applies them to every response the Worker serves), `apps/web/public/_headers` (generated from the module, for static assets), `security.csp` in `apps/web/astro.config.mjs` (the script hashes), `apps/web/src/server/csp-report.ts` (the report endpoint).

## Headers

| Header                              | Value                                                                                                                                               | Sent on                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Content-Security-Policy`           | [the page policy](#page-policy) on HTML pages; `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` on everything else | every response; Storybook has [its own](#storybook)          |
| `Reporting-Endpoints`               | `csp-endpoint="<origin>/api/csp-report"`                                                                                                            | HTML pages                                                   |
| `Strict-Transport-Security`         | `max-age=31536000; includeSubDomains`                                                                                                               | deployed environments over HTTPS ([HSTS](#hsts-and-preload)) |
| `X-Content-Type-Options`            | `nosniff`                                                                                                                                           | every response                                               |
| `Referrer-Policy`                   | `strict-origin-when-cross-origin`; a route that sets a stricter one keeps it (`no-referrer` on unsubscribe and exports)                             | every response                                               |
| `Permissions-Policy`                | camera, microphone, geolocation, payment, USB, sensors and the like `=()`; `publickey-credentials-get` and `-create` `=(self)` for passkeys         | every response                                               |
| `Cross-Origin-Opener-Policy`        | `same-origin`                                                                                                                                       | every response                                               |
| `Cross-Origin-Resource-Policy`      | `same-origin`                                                                                                                                       | every response                                               |
| `X-Frame-Options`                   | `DENY` (`SAMEORIGIN` under `/_storybook/`): the fallback of `frame-ancestors` for old browsers                                                      | every response                                               |
| `X-Permitted-Cross-Domain-Policies` | `none`                                                                                                                                              | every response                                               |

"Every response" means pages, redirects, `/api/*` (tRPC, files, auth, billing webhook), `/mcp`, `/.well-known/*`, `/health/*`, Problem Details errors (500 Server Misconfigured included) and static assets. Headers a route sets itself (`Cache-Control: no-store` on health, `Content-Disposition` on files) are kept.

Not sent, on purpose: `Cross-Origin-Embedder-Policy: require-corp` (OWASP lists it; it would block the Turnstile iframe and the Web Analytics beacon, which send no CORP header) and `Clear-Site-Data` (sign-out already revokes the session server-side).

COOP `same-origin` is compatible with every flow the app has: Google sign-in and the MCP OAuth consent leave by top-level navigation, not popups; Turnstile renders an iframe; passkeys are same-origin. A future popup-based flow (an OAuth popup, a payment provider) needs `same-origin-allow-popups` on its page.

## Page policy

What an HTML page of the app (`/`, `/sign-in`, `/app/*`, `/admin/*`, `/consent`, ...) gets, in a deployed environment with `TURNSTILE=on`:

```text
default-src 'self';
script-src https://<origin>/_astro/ 'sha256-…' … https://challenges.cloudflare.com;
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-src https://challenges.cloudflare.com;
worker-src 'self'; manifest-src 'self'; media-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri https://<origin>/api/csp-report;
report-to csp-endpoint
```

- **Scripts.** Only the app's bundles (`<origin>/_astro/`, not all of `'self'`: `/api/files` serves user uploads from the same origin, and a `<script src>` pointing at an upload must not run) and the inline scripts whose SHA-256 hash Astro computed at build (`security.csp`: the island hydration code). No `'unsafe-inline'`, no `'unsafe-eval'`, no inline event handlers (`script-src-attr 'none'`). The SPA's bootstrap is `<script type="application/json">`: data, which CSP does not run.
- **Styles.** Our stylesheets and inline styles (`'self' 'unsafe-inline'`, no hashes, [an exception](#exceptions)): Radix's modal primitives (Dialog, Sheet, menus, Select) append a `<style>` computed from the measured scrollbar width at runtime, which no build-time hash can match, and sonner injects its toast stylesheet. A hash in `style-src` would switch `'unsafe-inline'` off, so Astro's style hashes are dropped. Injected CSS cannot run script.
- **Third parties, only when their setting is on:**

  | Setting                            | Adds                                                                                                                 |
  | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
  | `TURNSTILE=on`                     | `https://challenges.cloudflare.com` to `script-src` and `frame-src` (the widget's script and its iframe)             |
  | `WEB_ANALYTICS=cloudflare`         | `https://static.cloudflareinsights.com` to `script-src`, `https://cloudflareinsights.com` to `connect-src`           |
  | presigned uploads (`R2_*` all set) | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_FILES_BUCKET_NAME>/` to `connect-src` (the browser PUTs there) |

- **Images.** `'self'` (avatars and logos come from `/api/account/avatar/*` and `/api/workspaces/*/logo/*`) and `data:` (the TOTP QR code).
- **Forms** post only to the app (`form-action 'self'`): Google sign-in and the OAuth consent redirect with `window.location`, which `form-action` does not govern.
- **Framing.** Nobody may frame the app (`frame-ancestors 'none'`, `X-Frame-Options: DENY`).
- **`upgrade-insecure-requests`** only in deployed environments over HTTPS.
- **The settings cannot be read** (a missing setting: the 500 Server Misconfigured case): the page policy is enforced without third parties.

Under `astro dev` Astro computes no hashes and Vite injects inline modules, so `script-src` becomes `'self' 'unsafe-inline'` (and `connect-src` gets Vite's `ws://` socket); every other directive is as deployed. The middleware knows it from `import.meta.env.DEV`; a build never gets the dev policy. This is why the build journeys exist: only they see the hashed `script-src`.

## CSP_MODE

`CSP_MODE` is a required var with no default, in every environment of `apps/web/wrangler.jsonc` (parsed in `parsePlatformConfig`, checked by `bun run doctor`):

| Value         | HTML pages get                                                                                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enforce`     | the page policy as `Content-Security-Policy`: violations are blocked and reported. The starter ships it in every environment, production included.                                                                                                                          |
| `report-only` | the page policy as `Content-Security-Policy-Report-Only` (violations are only reported; `upgrade-insecure-requests` is dropped, browsers ignore it there), plus an enforced baseline that never breaks a page: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` |

Non-HTML responses and static assets always get their enforced policy. Use `report-only` to roll out a change you are not sure of (a new third party, a library upgrade): deploy to staging with `report-only`, browse, read the `csp.violation` logs, fix, switch back to `enforce`. `doctor` warns while production is on `report-only`.

## Violation reports

Browsers send violations to `POST /api/csp-report`, both formats: `report-uri` (`application/csp-report`) and the Reporting API's `report-to` (`application/reports+json`, through `Reporting-Endpoints`). Each becomes one `csp.violation` warning in the logs ([how-to-setup-logging.md](how-to-setup-logging.md)):

| Field                            | Holds                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `app.csp.directive`              | the effective directive (`script-src-elem`, `connect-src`, ...)                       |
| `app.csp.blocked`                | what was blocked: origin and redacted path, or the keyword (`inline`, `eval`, `data`) |
| `app.csp.disposition`            | `enforce` or `report`                                                                 |
| `app.csp.document`               | the page: origin and redacted path                                                    |
| `app.csp.source`, `app.csp.line` | the script that caused it, when the browser says                                      |

URLs never keep their query or fragment, and path tokens are redacted (`redactUrlPath`), so reset or invitation links do not reach the logs. The endpoint is anonymous, reads at most 16 KiB (413 beyond), logs at most 10 reports per request, answers 204, and is limited by `csp.report` (30 a minute per IP, `RL_CSP_REPORT`; [how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md)). Workers Logs query: `body = "csp.violation"`, grouped by `app.csp.directive` and `app.csp.blocked`.

Expect some noise: browser extensions inject scripts and styles into pages and their violations are reported too (`app.csp.blocked` like `chrome-extension`, or `inline` from an extension's source). A violation from the app's own origin or a third party you configured is a real one.

## Static assets

Workers Static Assets serves `/_astro/*`, `/favicon.svg` and `/_storybook/*` without running the Worker, so the middleware cannot add headers there. `apps/web/public/_headers` does: Astro copies it into the build output, the Cloudflare adapter only prepends its `Cache-Control: immutable` rule for `/_astro/*` to it (verified with `@astrojs/cloudflare` 14.4), and Workers Static Assets applies it (`wrangler dev` and `astro preview` too). Every asset gets the base headers and the policy that loads nothing; HSTS is always in the file because deployed builds are served over HTTPS and browsers ignore HSTS on plain HTTP.

The file is generated: change `security-headers.ts`, then run

```bash
bun apps/web/scripts/write-static-headers.ts
```

`security-headers.test.ts` fails while the file is out of date. `astro dev` serves `public/` through Vite and applies no `_headers`; test assets with the build (`bun run test:e2e:build`) or `curl -I` against `astro preview`.

## Prerendered pages

The pages Astro prerenders (`/docs/*`; [how-to-publish-docs-and-landing.md](how-to-publish-docs-and-landing.md)) are static assets too, so they get their policy from `_headers`: `PRERENDERED_PAGE_PATHS` in `security-headers.ts` replace the asset policy with `PRERENDERED_PAGE_CSP` (`default-src 'self'`, scripts from this origin only, `script-src-attr 'none'`, inline styles allowed, the Web Analytics origins, no plugins, no framing, `report-uri /api/csp-report`). Astro also writes its policy into each prerendered page as a `<meta http-equiv="content-security-policy">` (script hashes, and the `style-src` of `security.csp.styleDirective`); the browser enforces both. Differences from the per-request page policy, because a static file knows neither the origin nor the settings:

- `script-src 'self'` instead of `<origin>/_astro/`: a source with a path needs the origin. The pages hold no user content, so nothing on them can point a script at `/api/files`.
- The Web Analytics origins are always allowed (the rule is the same in every environment).
- `style-src 'self' 'unsafe-inline'` also in the `<meta>`: Shiki colours code with `style` attributes, and a style hash in the policy would switch `'unsafe-inline'` off.

`test/e2e-build/docs.spec.ts` loads a docs page from the build under both policies with zero violations.

## Storybook

`/_storybook/*` (static, built by `storybook build`) has its own policy, set in `_headers` by removing the asset policy (`! Content-Security-Policy`) and adding:

```text
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self';
worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

with `X-Frame-Options: SAMEORIGIN`, because the manager frames the preview (`iframe.html`). This is the one place with `'unsafe-inline'` ([exceptions](#exceptions)). Storybook loads nothing from other origins and holds no user data; a project that wants it private protects the path with Cloudflare Access ([how-to-use-storybook.md](how-to-use-storybook.md#access)).

## Inline scripts and styles

No inline script runs on the app's pages unless its hash is in the policy (inline styles are allowed, see [Page policy](#page-policy)):

- **Astro renders it** (an island, a `<script>` in a `.astro` file that Astro bundles or hashes): nothing to do; Astro hashes it at build.
- **`is:inline` scripts** are not hashed: only data (`type="application/json"`) or an external file (`src=`) may be `is:inline`. Move code into a bundled `<script>` or a React component.
- **A library injects a `<script>` at runtime**: it is blocked. Load it as a bundled module instead, or, when its text is fixed, add its hash to `security.csp.scriptDirective.hashes` in `astro.config.mjs`, computed from the installed package at build time so an upgrade cannot leave a stale hash. Libraries that inject `<style>` need nothing.
- **Never** `dangerouslySetInnerHTML`, inline event handlers (`onclick=`) or `set:html` outside a JSON data block.

`test/architecture/security-headers.test.ts` checks the last three rules for every `.astro` file and component.

## Adding a third party

1. Prefer self-hosting (fonts are bundled with `@fontsource`; nothing loads from a CDN).
2. Add the narrowest source (an origin, with a path when the service allows) to `pagePolicy` in `security-headers.ts`, behind the setting that turns the integration on, never `*` or a scheme like `https:`.
3. Add a unit test in `security-headers.test.ts`, regenerate `_headers` if it is a static asset rule, and document the row in the table above.
4. Ship it with `CSP_MODE=report-only` to staging first when you are unsure what the service loads.

## Exceptions

| Exception                                               | Where             | Why                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'unsafe-inline'` for scripts and styles                | `/_storybook/*`   | Storybook's built pages carry inline scripts and styles that change every build, with no hash or nonce support; static, no user data, same-origin framing only                                                                                                                                     |
| `'unsafe-inline'` for scripts                           | `astro dev` only  | Vite injects inline modules; Astro computes no hashes in dev. Builds never get it                                                                                                                                                                                                                  |
| `'unsafe-inline'` for styles                            | page policy       | Radix computes its scroll-lock `<style>` at runtime (no hash can match) and sonner injects its stylesheet; CSS cannot run script, `script-src` stays strict. Revisit if the UI library offers a nonce hook (`get-nonce`) and Astro gains nonces. Prerendered pages too: Shiki's `style` attributes |
| Better Auth's HTML error page unstyled                  | `/api/auth/error` | Under `/api/`, so it gets the policy that loads nothing; its inline `<style>` is blocked (and not reported). Users see it only on a broken OAuth authorize request. Point Better Auth's `onAPIError.errorURL` at an app page to change it                                                          |
| Hashes, not nonces                                      | page policy       | Astro 7's built-in CSP (`security.csp`) is hash-based; hashes are as strict (CSP Level 3) and keep pages cacheable. No HTML rewriting to add nonces                                                                                                                                                |
| No `'strict-dynamic'`                                   | page policy       | The pages load parser-inserted scripts (Astro's bundles, the beacon) that `'strict-dynamic'` would block, since it makes `'self'` and host sources ignored; the bundle path and the named hosts are the allowlist instead                                                                          |
| `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN` | `/_storybook/*`   | the manager frames its preview iframe                                                                                                                                                                                                                                                              |
| No COEP                                                 | everywhere        | would block Turnstile and the beacon                                                                                                                                                                                                                                                               |

## HSTS and preload

`Strict-Transport-Security: max-age=31536000; includeSubDomains` is sent in deployed environments (`APP_ENV` develop, staging, production) over HTTPS, never locally. It covers subdomains: before deploying to a domain whose subdomains include plain-HTTP sites, check them or drop `includeSubDomains`. There is no `preload` by default: preloading puts the whole registrable domain (every subdomain, forever in practice) on the browsers' built-in HTTPS-only list, which is the domain owner's decision, not the starter's. To preload, add `preload` to `HSTS_VALUE`, regenerate `_headers`, deploy, and submit the domain at [hstspreload.org](https://hstspreload.org/).

## Tests

| Test                                                  | Covers                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/security-headers.test.ts` (unit) | the page policy per setting (Turnstile, Web Analytics, presigned uploads, dev, deployed), `CSP_MODE`, the non-HTML policy, `_headers` is current                                                                                                                                                         |
| `apps/web/src/server/csp-report.test.ts` (unit)       | both report formats, URL reduction and redaction                                                                                                                                                                                                                                                         |
| `apps/web/test/api/security-headers.test.ts` (API)    | headers on pages, redirects, `/api/hello`, `/api/auth/*`, `/mcp` (OPTIONS, POST), `/health/live`, misconfigured 500s, uploads served as HTML; the report endpoint (204, 400, 413, 415, 429)                                                                                                              |
| `apps/web/test/e2e/fixtures.ts` (every E2E journey)   | any CSP violation in any page or frame fails the journey. Under `astro dev` scripts and styles may be inline, so the dev journeys prove the other directives (connect, img, frame, form, framing) for sign-up, passkeys, uploads, settings, admin, billing; the build journeys prove `script-src`        |
| `apps/web/test/e2e-build/` (`bun run test:e2e:build`) | the built app under `astro preview`: hashed policy on public pages; a signed-up user with the real Turnstile widget (Cloudflare's test keys, needs the network), a Radix dialog and select, a profile save and a passkey ceremony; an injected inline script blocked; framing refused; Storybook; assets |
| `test/architecture/security-headers.test.ts`          | no un-hashed inline scripts, `set:html` only for data, no inline handlers or `dangerouslySetInnerHTML`; specs use the guarded `test`                                                                                                                                                                     |

Run the build journeys after `bun run build` (they need `apps/web/.dev.vars` before the build, which copies it next to the built Worker for `astro preview`, and a migrated local D1, like `test:e2e`, and reach challenges.cloudflare.com for the real widget); CI runs them in the `build` job. They serve on `APP_URL`'s port (Better Auth trusts only that origin), so stop `bun run dev:web` first.

To check a deployed environment by hand:

```bash
curl -sI https://<your-app>/ | grep -i -E 'content-security|strict-transport|x-frame|x-content|referrer|permissions|cross-origin'
```

## Edge-injected Web Analytics

Cloudflare can inject its Web Analytics (RUM) beacon into HTML at the edge, after the Worker answered: a zone or site with "automatic setup" adds `<script src="https://static.cloudflareinsights.com/beacon.min.js/…">` to every page, whatever `WEB_ANALYTICS` says. The page policy allows that script only with `WEB_ANALYTICS=cloudflare`, so with `WEB_ANALYTICS=none` and automatic setup on, every page view reports a blocked `script-src-elem` from `static.cloudflareinsights.com` and the beacon does not run. Pick one, per environment:

- Keep analytics off: turn automatic setup off for the hostname (Cloudflare dashboard, Web Analytics, the site, Manage site), so nothing is injected.
- Keep analytics on: set `WEB_ANALYTICS=cloudflare` with the site's token (`bun run setup:analytics --env <env>`) and turn automatic setup off, so the app loads the beacon itself (and skips it on pages whose URL carries a token).

Check what the edge serves with a browser user agent, since the injection only happens for browsers:

```bash
curl -s -H 'Accept: text/html' -H 'User-Agent: Mozilla/5.0' https://<your-app>/ | grep -o 'cloudflareinsights[^"]*'
```

## Troubleshooting

- **"Refused to load the script … because it violates … script-src"** for a new library or service: [add the third party](#adding-a-third-party). For the app's own code: it is not under `/_astro/` or is an un-hashed inline script ([inline scripts](#inline-scripts-and-styles)).
- **A script blocked after a dependency upgrade** (`script-src-elem`, `inline`): the library now injects a `<script>`; see [inline scripts](#inline-scripts-and-styles).
- **An E2E journey fails with "Content-Security-Policy violations"**: the attached `csp-violations.json` names the page, directive and blocked URL.
- **Works under `astro dev`, blocked in the build**: inline code; dev allows it, builds do not. `bun run test:e2e:build` reproduces it.
- **A page embedded elsewhere is blank**: framing is refused on purpose; allow a named origin in `frame-ancestors` for that route only if embedding is a product decision.
