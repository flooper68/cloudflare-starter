/**
 * The docs site (/docs, apps/web/src/docs/) stays whole:
 * - every docs/**\/*.md is reachable from the navigation (built from docs/README.md) or
 *   listed in DOCS.exempt with a reason, and no exemption is stale;
 * - every relative link in a published file names a file or folder that exists, and
 *   every `#fragment` (to the same or another Markdown file) names a heading there, with
 *   GitHub's heading ids (github-slugger), which the site uses too.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import GithubSlugger from "github-slugger";
import { describe, expect, it } from "vitest";

import { DOCS } from "@/docs/docs.config";
import { isPublished, parseRepoLink } from "@/docs/links";
import { buildNav, docTitle, navPaths } from "@/docs/nav";

import { filesUnder, ROOT, read } from "./repo";

const DOCS_FILES = filesUnder("docs", /\.md$/);
/** Every file the site publishes: the whole repository filtered by DOCS.sources. */
const PUBLISHED = filesUnder(".", /\.md$/).filter(isPublished);

/** The Markdown without fenced code blocks. */
function withoutFences(source: string): string {
  return source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "");
}

/** The Markdown without fenced code blocks and inline code spans. */
function prose(source: string): string {
  return withoutFences(source).replace(/`+[^`\n]*`+/g, "");
}

/**
 * Heading ids as GitHub (and the site, with smart punctuation off) generate them: the
 * heading's text (link text kept, code kept without backticks, tags dropped) through
 * one github-slugger per file, so repeated headings get their `-1` suffix.
 */
function headingIds(source: string): Set<string> {
  const slugger = new GithubSlugger();
  const ids = new Set<string>();
  for (const match of withoutFences(source).matchAll(
    /^#{1,6}[ \t]+(.+?)[ \t#]*$/gm
  )) {
    const text = match[1]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/`/g, "");
    ids.add(slugger.slug(text));
  }
  return ids;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function links(source: string): string[] {
  return [
    ...prose(source).matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
  ].map((match) => match[1]);
}

describe("docs site", () => {
  const titles = new Map(
    PUBLISHED.map((path) => [path, docTitle(read(path)) ?? path])
  );
  const inNav = new Set(navPaths(buildNav(read(DOCS.navSource), titles)));

  it("publishes every file under docs/", () => {
    expect(DOCS_FILES.filter((path) => !isPublished(path))).toEqual([]);
  });

  it.each(DOCS_FILES)(
    "%s is in the navigation or exempt with a reason",
    (path) => {
      const reason = DOCS.exempt[path];
      expect(
        inNav.has(path) || Boolean(reason?.trim()),
        `link ${path} from ${DOCS.navSource}, or add it to DOCS.exempt (apps/web/src/docs/docs.config.ts) with a reason`
      ).toBe(true);
    }
  );

  it("has no stale exemptions", () => {
    const stale = Object.keys(DOCS.exempt).filter(
      (path) => !DOCS_FILES.includes(path) || inNav.has(path)
    );
    expect(stale, "remove these from DOCS.exempt").toEqual([]);
  });

  it("gives every published file a title", () => {
    expect(PUBLISHED.filter((path) => docTitle(read(path)) === null)).toEqual(
      []
    );
  });

  it.each(PUBLISHED)("every relative link in %s resolves", (path) => {
    const source = read(path);
    const broken: string[] = [];
    for (const href of links(source)) {
      if (href.startsWith("#")) {
        if (!headingIds(source).has(decodeURIComponent(href.slice(1))))
          broken.push(`${href}: no such heading here`);
        continue;
      }
      const link = parseRepoLink(path, href);
      if (!link) {
        // Absolute URLs and site paths are fine; a relative path that leaves the
        // repository is broken on the site and on GitHub.
        if (!SCHEME.test(href) && !href.startsWith("/"))
          broken.push(`${href}: leaves the repository`);
        continue;
      }
      const target = join(ROOT, link.path);
      if (!existsSync(target)) {
        broken.push(`${href}: ${link.path} does not exist`);
        continue;
      }
      if (link.anchor && link.path.endsWith(".md")) {
        if (!headingIds(read(link.path)).has(decodeURIComponent(link.anchor)))
          broken.push(`${href}: no heading #${link.anchor} in ${link.path}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
