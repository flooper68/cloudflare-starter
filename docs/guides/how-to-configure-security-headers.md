# How To Configure Security Headers (CSP, HSTS And Friends)

::reviewed{date="2026-11-09"}

Every response carries the headers the OWASP Secure Headers Project recommends, and every HTML page a strict Content Security Policy: scripts only from the app's own bundles and the inline code Astro hashed at build time, third parties only when their setting is on, violations reported to `/api/csp-report`. Use this guide to add a third-party script, frame or API, roll out a policy change, or read a violation.

::flow[Request -> Page policy built per request -> Browser enforces -> Violations reported]{title="Security headers: each response gets its policy, the browser enforces it and reports violations"}

## Add a third party

:::steps
1. **Prefer self-hosting.** Fonts are bundled; nothing loads from a CDN.
2. **Add the narrowest source** (an origin, with a path when the service allows) to `pagePolicy` in `apps/web/src/server/security-headers.ts`, behind the setting that turns the integration on. Never `*` or a scheme like `https:`.
3. **Add a unit test** in `security-headers.test.ts`.
4. **Ship it to staging in report-only** when you are not sure what the service loads.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Allow <service> on the app's pages: add the narrowest sources to the page policy behind
its setting, with a unit test, following docs/guides/how-to-configure-security-headers.md.
Then tell me how to try it on staging with CSP_MODE=report-only.
```
:::

## Roll out a policy change

:::settings
- CSP_MODE = enforce (enforce | report-only) Block and report violations, or only report them
  :::

Deploy to staging with `report-only`, browse, read the `csp.violation` log records, fix, switch back to `enforce`. `bun run doctor` warns while production is on `report-only`.

## Inline scripts

No inline script runs unless its hash is in the policy. Scripts Astro bundles or hashes need nothing; `is:inline` only for data or an external `src`; a library that injects a `<script>` is loaded as a bundled module instead.

:::gotcha{title="Never dangerouslySetInnerHTML, onclick= or set:html"}
`test/architecture/security-headers.test.ts` fails on them in any `.astro` file or component.
:::

:::decision{title="Why the policy is built per request"}
Only the pages' own hashes and the integrations that are switched on are allowed, so an integration you turned off cannot load scripts.
:::

## Reference

Every header and where it is sent, the page policy, static assets, prerendered pages, Storybook, exceptions, HSTS, tests, edge-injected Web Analytics and troubleshooting: [Security headers reference](../reference/security-headers.md).
