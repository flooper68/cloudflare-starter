/**
 * Inside the signed-in SPA (/app), a link to another /app page routes client-side: a
 * router `<Link>` or `navigate()`, never a plain `<a href="/app/…">` or
 * `window.location` to an /app path, which reloads the whole document (and drops the
 * app's state). Real document loads (/docs, /_storybook/, /admin, /api, sign-out, OAuth,
 * downloads) are not /app paths and are not matched. The few deliberate /app reloads are
 * listed with their reason. Docs: docs/guides/how-to-add-a-feature.md.
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

/** The SPA's components: everything the /app router renders. */
const SPA_FILES = [
  ...filesUnder("apps/web/src/components/app", /\.tsx?$/),
  ...filesUnder("apps/web/src/components/settings", /\.tsx?$/),
  ...filesUnder("apps/web/src/components/shared/spa", /\.tsx?$/),
].filter((path) => !/\.test\.tsx?$/.test(path));

/** `href="/app…"`, `href={"/app…"}`, `href={`/app…`}`, and window.location to /app. */
const RELOADING_APP_LINK =
  /href=\{?\s*["'`]\/app\b|location\.(?:href\s*=|assign\(|replace\()\s*["'`]\/app\b/g;

/** Deliberate document loads of an /app page: `path` → reason. */
const ALLOWED: Readonly<Record<string, string>> = {
  "apps/web/src/components/settings/SecurityFactors.tsx":
    "Continue to app on the /two-factor Astro page, outside the SPA (continueToApp)",
  "apps/web/src/components/settings/pages/WorkspaceSettingsPage.tsx":
    "after deleting the active workspace, a full load resets the app's workspace state",
};

function reloadingLinks(path: string): string[] {
  return [...read(path).matchAll(RELOADING_APP_LINK)].map((m) => m[0]);
}

/** A plain `<a>` whose href is computed: it could be an /app path, so it needs a reason. */
const COMPUTED_ANCHOR = /<a\b[^>]*?\bhref=\{(?!\s*["'`])/g;

/** Plain anchors with a computed href that is never an SPA page: `path` → reason. */
const COMPUTED_ALLOWED: Readonly<Record<string, string>> = {
  "apps/web/src/components/app/components/AppSidebar.tsx":
    "only `document` entries (the admin portal, docs, component library); app pages use Link",
  "apps/web/src/components/app/pages/DashboardPage.tsx":
    "only /verify-email, an Astro page; app pages use Link",
};

function computedAnchors(path: string): string[] {
  return [...read(path).matchAll(COMPUTED_ANCHOR)].map((m) => m[0]);
}

describe("SPA links", () => {
  it("finds the SPA's components", () => {
    expect(SPA_FILES).toContain(
      "apps/web/src/components/settings/SettingsLayout.tsx"
    );
    expect(SPA_FILES).toContain(
      "apps/web/src/components/app/components/AppSidebar.tsx"
    );
  });

  it("links to /app pages with the router, not a page reload", () => {
    const offenders = SPA_FILES.filter((path) => !(path in ALLOWED)).flatMap(
      (path) => reloadingLinks(path).map((match) => `${path}: ${match}`)
    );
    expect(offenders).toEqual([]);
  });

  it("gives a plain anchor a computed href only where it is never an SPA page", () => {
    const offenders = SPA_FILES.filter(
      (path) => !(path in COMPUTED_ALLOWED)
    ).flatMap((path) =>
      computedAnchors(path).map((match) => `${path}: ${match}`)
    );
    expect(offenders).toEqual([]);
  });

  it("lists only files that still do a deliberate reload or computed anchor", () => {
    const stale = [
      ...Object.keys(ALLOWED).filter(
        (path) => reloadingLinks(path).length === 0
      ),
      ...Object.keys(COMPUTED_ALLOWED).filter(
        (path) => computedAnchors(path).length === 0
      ),
    ];
    expect(stale).toEqual([]);
  });

  it("catches a plain anchor and a location assignment to /app", () => {
    const sample = [
      '<a href="/app/settings/security">Security</a>',
      'window.location.href = "/app/dashboard";',
      "window.location.assign(`/app/notes`);",
      '<a href="/docs/">Docs</a>',
      '<a href="/_storybook/">Library</a>',
    ].join("\n");
    expect([...sample.matchAll(RELOADING_APP_LINK)]).toHaveLength(3);
  });

  it("catches a plain anchor with a computed href, as the old settings nav had", () => {
    const sample = [
      "<a\n  key={item.id}\n  href={item.to}\n>",
      '<a href={"/docs/"}>Docs</a>',
      "<Link to={item.to}>",
    ].join("\n");
    expect([...sample.matchAll(COMPUTED_ANCHOR)]).toHaveLength(1);
  });
});
