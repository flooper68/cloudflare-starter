# Security headers reference

::reviewed{date="2026-11-09"}

The detail behind [the guide](../guides/how-to-configure-security-headers.md) on security headers and the content policy: read it when the guide is not enough.

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
script-src https://<origin>/_astro/ https://<origin>/site-theme.js 'sha256-…' … https://challenges.cloudflare.com;
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

- **Scripts.** Only the app's bundles (`<origin>/_astro/`, not all of `'self'`: `/api/files` serves user uploads from the same origin, and a `<script src>` pointing at an upload must not run), the theme script `<origin>/site-theme.js` (`THEME_SCRIPT_PATH`: a source without a trailing slash matches that one file, which the build owns; it applies the saved theme before the first paint, which a deferred bundle cannot) and the inline scripts whose SHA-256 hash Astro computed at build (`security.csp`: the island hydration code). No `'unsafe-inline'`, no `'unsafe-eval'`, no inline event handlers (`script-src-attr 'none'`). The SPA's bootstrap is `<script type="application/json">`: data, which CSP does not run.
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

Browsers send violations to `POST /api/csp-report`, both formats: `report-uri` (`application/csp-report`) and the Reporting API's `report-to` (`application/reports+json`, through `Reporting-Endpoints`). Each becomes one `csp.violation` warning in the logs ([how-to-setup-logging.md](../guides/how-to-setup-logging.md)):

| Field                            | Holds                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `app.csp.directive`              | the effective directive (`script-src-elem`, `connect-src`, ...)                       |
| `app.csp.blocked`                | what was blocked: origin and redacted path, or the keyword (`inline`, `eval`, `data`) |
| `app.csp.disposition`            | `enforce` or `report`                                                                 |
| `app.csp.document`               | the page: origin and redacted path                                                    |
| `app.csp.source`, `app.csp.line` | the script that caused it, when the browser says                                      |

URLs never keep their query or fragment, and path tokens are redacted (`redactUrlPath`), so reset or invitation links do not reach the logs. The endpoint is anonymous, reads at most 16 KiB (413 beyond), logs at most 10 reports per request, answers 204, and is limited by `csp.report` (30 a minute per IP, `RL_CSP_REPORT`; [how-to-configure-abuse-protection.md](../guides/how-to-configure-abuse-protection.md)). Workers Logs query: `body = "csp.violation"`, grouped by `app.csp.directive` and `app.csp.blocked`.

Expect some noise: browser extensions inject scripts and styles into pages and their violations are reported too (`app.csp.blocked` like `chrome-extension`, or `inline` from an extension's source). A violation from the app's own origin or a third party you configured is a real one.

## Static assets

Workers Static Assets serves `/_astro/*`, `/favicon.svg` and `/_storybook/*` without running the Worker, so the middleware cannot add headers there. `apps/web/public/_headers` does: Astro copies it into the build output, the Cloudflare adapter leaves it alone (it adds a `Cache-Control: immutable` block for `/_astro/*` only when no rule sets one; ours does, since a second block for the same path would replace the first; verified with `@astrojs/cloudflare` 14.4), and Workers Static Assets applies it (`wrangler dev` and `astro preview` too). HSTS is always in the file because deployed builds are served over HTTPS and browsers ignore HSTS on plain HTTP.

Cloudflare applies every rule whose path matches, appends a header a second rule sets again (a second `Content-Security-Policy`, which browsers both enforce), and does not apply the rules in the file's order: production applied `/` before `/*`, so a `/*` policy that `/` detached with `! Content-Security-Policy` came back and the landing page loaded nothing. `astro preview` applies them in file order and hides this. So:

- `/*` carries only the headers that are the same on every path (the base headers and HSTS).
- `Content-Security-Policy` and `X-Frame-Options` are set per path group, in rules that never overlap, and nothing detaches them: the policy that loads nothing on `STATIC_ASSET_PATHS` (`/_astro/*`, `/favicon.svg`, `/site-theme.js`, `/robots.txt`, `/sitemap-*`), the prerendered page policy on `/`, `/docs/*` and the 404, Pagefind's and Storybook's on theirs.
- A new file in `public/` (or a new non-HTML route) needs its path in `STATIC_ASSET_PATHS`. `security-headers.test.ts` fails for a public file no rule covers, and `test/e2e-build/security-headers.spec.ts` runs every built file through `test/static-headers-model.ts` (Cloudflare's matching, in file, lexicographic and reverse order) and fails on a missing, doubled or order-dependent header.

The file is generated: change `security-headers.ts`, then run

```bash
bun apps/web/scripts/write-static-headers.ts
```

`security-headers.test.ts` fails while the file is out of date. `astro dev` serves `public/` through Vite and applies no `_headers`; test assets with the build (`bun run test:e2e:build`) or `curl -I` against `astro preview`.

## Prerendered pages

The pages Astro prerenders (the landing page `/`, `/docs/*`, and the 404 the Worker answers unknown paths with, served as `/404`; [how-to-publish-docs-and-landing.md](../guides/how-to-publish-docs-and-landing.md)) are static assets too, so they get their policy from `_headers`: `PRERENDERED_PAGE_PATHS` in `security-headers.ts` get `PRERENDERED_PAGE_CSP` (`default-src 'self'`, scripts from this origin only, `script-src-attr 'none'`, inline styles allowed, the Web Analytics origins, no plugins, no framing, `report-uri /api/csp-report`). Astro also writes its policy into each prerendered page as a `<meta http-equiv="content-security-policy">` (script hashes, and the `style-src` of `security.csp.styleDirective`); the browser enforces both. Differences from the per-request page policy, because a static file knows neither the origin nor the settings:

- `script-src 'self'` instead of `<origin>/_astro/`: a source with a path needs the origin. The pages hold no user content, so nothing on them can point a script at `/api/files`.
- The Web Analytics origins are always allowed (the rule is the same in every environment).
- `style-src 'self' 'unsafe-inline'` also in the `<meta>`: Shiki colours code with `style` attributes, and a style hash in the policy would switch `'unsafe-inline'` off.
- `'wasm-unsafe-eval'` in `script-src` (header and `<meta>`, through `security.csp.scriptDirective`): the docs search (Pagefind) compiles WebAssembly. It allows no JavaScript `eval`.

The docs search runs in a Web Worker started from `/pagefind/`, and a worker runs under the policy of its own script's response: `/pagefind/*` gets `PAGEFIND_CSP` (`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`) instead of the asset policy.

`test/e2e-build/docs.spec.ts` loads a docs page and the 404 from the build under these policies with zero violations.

## Storybook

`/_storybook/*` (static, built by `storybook build`) has its own policy, set in `_headers` on `/_storybook/*`:

```text
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self';
worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

with `X-Frame-Options: SAMEORIGIN` instead of `DENY`, because the manager frames the preview (`iframe.html`). This is the one place with `'unsafe-inline'` ([exceptions](#exceptions)). Storybook loads nothing from other origins and holds no user data; a project that wants it private protects the path with Cloudflare Access ([how-to-use-storybook.md](../guides/how-to-use-storybook.md#access)).

## Inline scripts and styles

No inline script runs on the app's pages unless its hash is in the policy (inline styles are allowed, see [Page policy](#page-policy)):

- **Astro renders it** (an island, a `<script>` in a `.astro` file that Astro bundles or hashes): nothing to do; Astro hashes it at build.
- **`is:inline` scripts** are not hashed: only data (`type="application/json"`) or an external file (`src=`) may be `is:inline`. Move code into a bundled `<script>` or a React component.
- **A library injects a `<script>` at runtime**: it is blocked. Load it as a bundled module instead, or, when its text is fixed, add its hash to `security.csp.scriptDirective.hashes` in `astro.config.mjs`, computed from the installed package at build time so an upgrade cannot leave a stale hash. Libraries that inject `<style>` need nothing.
- **Never** `dangerouslySetInnerHTML`, inline event handlers (`onclick=`) or `set:html` outside a JSON data block.

`test/architecture/security-headers.test.ts` checks the last three rules for every `.astro` file and component.

## Adding a third party

1. Prefer self-hosting (fonts are bundled with `@fontsource`; nothing loads from a CDN). `vite.build.assetsInlineLimit` in `apps/web/astro.config.mjs` keeps font files as files: a small subset inlined as a `data:` URL is blocked by `font-src 'self'`.
2. Add the narrowest source (an origin, with a path when the service allows) to `pagePolicy` in `security-headers.ts`, behind the setting that turns the integration on, never `*` or a scheme like `https:`.
3. Add a unit test in `security-headers.test.ts`, regenerate `_headers` if it is a static asset rule, and document the row in the table above.
4. Ship it with `CSP_MODE=report-only` to staging first when you are unsure what the service loads.

## Exceptions

| Exception                                               | Where                                 | Why                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'unsafe-inline'` for scripts and styles                | `/_storybook/*`                       | Storybook's built pages carry inline scripts and styles that change every build, with no hash or nonce support; static, no user data, same-origin framing only                                                                                                                                     |
| `'unsafe-inline'` for scripts                           | `astro dev` only                      | Vite injects inline modules; Astro computes no hashes in dev. Builds never get it                                                                                                                                                                                                                  |
| `'unsafe-inline'` for styles                            | page policy                           | Radix computes its scroll-lock `<style>` at runtime (no hash can match) and sonner injects its stylesheet; CSS cannot run script, `script-src` stays strict. Revisit if the UI library offers a nonce hook (`get-nonce`) and Astro gains nonces. Prerendered pages too: Shiki's `style` attributes |
| `'wasm-unsafe-eval'`                                    | `/`, `/docs/*`, `/404`, `/pagefind/*` | Pagefind (the docs search) compiles WebAssembly; it permits no JavaScript `eval`                                                                                                                                                                                                                   |
| Better Auth's HTML error page unstyled                  | `/api/auth/error`                     | Under `/api/`, so it gets the policy that loads nothing; its inline `<style>` is blocked (and not reported). Users see it only on a broken OAuth authorize request. Point Better Auth's `onAPIError.errorURL` at an app page to change it                                                          |
| Hashes, not nonces                                      | page policy                           | Astro 7's built-in CSP (`security.csp`) is hash-based; hashes are as strict (CSP Level 3) and keep pages cacheable. No HTML rewriting to add nonces                                                                                                                                                |
| No `'strict-dynamic'`                                   | page policy                           | The pages load parser-inserted scripts (Astro's bundles, the beacon) that `'strict-dynamic'` would block, since it makes `'self'` and host sources ignored; the bundle path and the named hosts are the allowlist instead                                                                          |
| `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN` | `/_storybook/*`                       | the manager frames its preview iframe                                                                                                                                                                                                                                                              |
| No COEP                                                 | everywhere                            | would block Turnstile and the beacon                                                                                                                                                                                                                                                               |

## HSTS and preload

`Strict-Transport-Security: max-age=31536000; includeSubDomains` is sent in deployed environments (`APP_ENV` develop, staging, production) over HTTPS, never locally. It covers subdomains: before deploying to a domain whose subdomains include plain-HTTP sites, check them or drop `includeSubDomains`. There is no `preload` by default: preloading puts the whole registrable domain (every subdomain, forever in practice) on the browsers' built-in HTTPS-only list, which is the domain owner's decision, not the starter's. To preload, add `preload` to `HSTS_VALUE`, regenerate `_headers`, deploy, and submit the domain at [hstspreload.org](https://hstspreload.org/).

## Tests

| Test                                                  | Covers                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/security-headers.test.ts` (unit) | the page policy per setting (Turnstile, Web Analytics, presigned uploads, dev, deployed), `CSP_MODE`, the non-HTML policy, `no-transform` on HTML only, `_headers` is current (`no-transform` on every static HTML path); `cache-control.test.ts` the merge                                                                                                                               |
| `apps/web/src/server/csp-report.test.ts` (unit)       | both report formats, URL reduction and redaction                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/test/api/security-headers.test.ts` (API)    | headers on pages, redirects, `/api/hello`, `/api/auth/*`, `/mcp` (OPTIONS, POST), `/health/live`, misconfigured 500s, uploads served as HTML; `no-transform` on pages (both `WEB_ANALYTICS` values, prerendered pass-through, `no-store` kept), not on redirects, API or health; the report endpoint (204, 400, 413, 415, 429)                                                            |
| `apps/web/test/e2e/fixtures.ts` (every E2E journey)   | any CSP violation in any page or frame fails the journey. Under `astro dev` scripts and styles may be inline, so the dev journeys prove the other directives (connect, img, frame, form, framing) for sign-up, passkeys, uploads, settings, admin, billing; the build journeys prove `script-src`. The production smoke suite runs under it too                                           |
| `apps/web/test/e2e-build/` (`bun run test:e2e:build`) | the built app under `astro preview`: hashed policy on public pages; a signed-up user with the real Turnstile widget (Cloudflare's test keys, needs the network), a Radix dialog and select, a profile save and a passkey ceremony; an injected inline script blocked; framing refused; Storybook; assets; `Cache-Control` of every kind of HTML response (`no-transform`) and of the rest |
| `test/architecture/security-headers.test.ts`          | no un-hashed inline scripts, `set:html` only for data, no inline handlers or `dangerouslySetInnerHTML`; specs use the guarded `test`                                                                                                                                                                                                                                                      |

Run the build journeys after `bun run build` (they need `apps/web/.dev.vars` before the build, which copies it next to the built Worker for `astro preview`, and a migrated local D1, like `test:e2e`, and reach challenges.cloudflare.com for the real widget); CI runs them in the `build` job. They serve on `APP_URL`'s port (Better Auth trusts only that origin), so stop `bun run dev:web` first.

To check a deployed environment by hand:

```bash
curl -sI https://<your-app>/ | grep -i -E 'content-security|strict-transport|x-frame|x-content|referrer|permissions|cross-origin'
```

## Edge-injected Web Analytics

Cloudflare can inject its Web Analytics (RUM) beacon into HTML at the edge, after the Worker answered: a zone with Web Analytics "automatic setup" adds `<script src="https://static.cloudflareinsights.com/beacon.min.js/…">` to every page on every subdomain of the zone, whatever `WEB_ANALYTICS` says. The setting is per zone, so it is often shared with other sites that want it (starter.flooper.me shares flooper.me's), and a per-hostname rule needs the Pro plan. The policy of pages rendered per request allows that script only with `WEB_ANALYTICS=cloudflare`; without a defence every view of such a page would report a blocked `script-src-elem` from `static.cloudflareinsights.com`, log a console error and fail the production smoke suite. The prerendered pages always allow it, so there an injected beacon would run and count visits the environment did not ask for.

So **every HTML response carries `Cache-Control: no-transform`**. Cloudflare's [Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/) and [get-started guide](https://developers.cloudflare.com/web-analytics/get-started/) state that with `Cache-Control: public, no-transform` the proxy cannot modify the payload, so the beacon is not injected; [Cloudflare's Cache-Control reference](https://developers.cloudflare.com/cache/concepts/cache-control/) lists `no-transform` on its own as "does not transform body" while Origin Cache Control is on (the default below Enterprise). The zone setting stays on for the other sites.

| Response                                                                                                                                | Cache-Control                                                                              | Set by                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Pages rendered per request (`/sign-in`, `/app/*`, `/admin/*`, `/consent`, ...)                                                          | `no-transform`, merged into what the page set (`no-store, no-transform` on `/unsubscribe`) | `securityHeadersFor` (middleware)        |
| Other HTML the Worker serves (an upload opened as HTML, Better Auth's error page)                                                       | merged the same way (`private, no-store, no-transform`)                                    | `securityHeadersFor`                     |
| Prerendered pages `/`, `/docs/*`, the 404 (`/404`, `/404.html`, and unknown paths), Storybook's `/_storybook/` and `/_storybook/iframe` | `public, max-age=0, must-revalidate, no-transform`                                         | `STATIC_CACHE_RULES` → `public/_headers` |
| Everything else: redirects, API, `/mcp`, health, assets, the Atom feed `/docs/changelog.xml`                                            | unchanged                                                                                  |                                          |

The choices behind it:

- **`public` is never added.** A page rendered per request may be someone's own, and `public` would let shared caches store it; `no-store` and `private` stay. The prerendered pages already were `public`. Cloudflare documents the combination `public, no-transform`; that the edge also skips the injection on a response with only `no-transform`, or with `private` or `no-store`, follows from the Cache-Control reference but is not stated for Web Analytics in so many words. If a production check still finds the beacon on those pages, that is why ([check it](#check-it)).
- **Also with `WEB_ANALYTICS=cloudflare`.** The app then loads the beacon itself (and leaves it out of pages whose URL carries a token); an injected second snippet would double it ("only one JS snippet can be rendered and used per page", the FAQ says), and `public/_headers` is the same file in every environment anyway. It also keeps out the edge's other body rewrites (the Cache-Control reference names the email filter, that is Email Address Obfuscation), whose scripts the policy would block too.
- **The cost: the edge does not compress HTML.** `no-transform` also turns off Cloudflare's gzip and Brotli for those responses (and Polish, which only touches images). A large docs page goes over the wire at about 80 KB instead of 15 KB; the landing page at about 40 KB instead of 7 KB. Non-HTML responses (scripts, styles, the feed) are compressed as before. If that matters more than the zone setting, a Worker could compress its own HTML (`Content-Encoding` on the response), which the edge then passes through.
- **To use Cloudflare's automatic setup instead** of the app's beacon, remove `no-transform` and allow the beacon in the policy; the starter does not support that.

### Check it

What the edge serves, with a browser user agent, since the injection only happens for browsers (no output means no beacon):

```bash
for path in / /docs/ /sign-in /no-such-page; do
  curl -s -H 'Accept: text/html' -H 'User-Agent: Mozilla/5.0' "https://<your-app>$path" | grep -o '<script[^>]*cloudflareinsights[^>]*>'
done
curl -sI https://<your-app>/sign-in | grep -i '^cache-control'   # no-transform
```

The production smoke suite does the same on every deploy: with `WEB_ANALYTICS=none` it fails when a public page's HTML holds a beacon script (with `cloudflare`, when it holds more than one), and, like every E2E journey, on any CSP violation ([how-to-qa-a-deployment.md](../guides/how-to-qa-a-deployment.md)). Locally nothing injects: `bun run test:e2e:build` and `curl -I` against `astro preview` prove only that the headers are sent.

## Troubleshooting

- **"Refused to load the script … because it violates … script-src"** for a new library or service: [add the third party](#adding-a-third-party). For the app's own code: it is not under `/_astro/` or is an un-hashed inline script ([inline scripts](#inline-scripts-and-styles)).
- **A script blocked after a dependency upgrade** (`script-src-elem`, `inline`): the library now injects a `<script>`; see [inline scripts](#inline-scripts-and-styles).
- **An E2E journey fails with "Content-Security-Policy violations"**: the attached `csp-violations.json` names the page, directive and blocked URL.
- **Works under `astro dev`, blocked in the build**: inline code; dev allows it, builds do not. `bun run test:e2e:build` reproduces it.
- **A page embedded elsewhere is blank**: framing is refused on purpose; allow a named origin in `frame-ancestors` for that route only if embedding is a product decision.
