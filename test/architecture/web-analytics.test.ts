/**
 * Pages whose URL carries a credential never load the Web Analytics beacon
 * (docs/guides/how-to-setup-product-analytics.md#web-analytics): an `.astro` page under
 * apps/web/src/pages with a `[token]` route segment, or that reads a token from the query
 * string (`searchParams.get("t" | "token")`), renders `<Layout … analytics={false}>`.
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

const PAGES = filesUnder("apps/web/src/pages", /\.astro$/);
const TOKEN_IN_QUERY = /searchParams\.get\(\s*["'](t|token)["']\s*\)/;

function carriesToken(path: string): boolean {
  return /\[token\]/.test(path) || TOKEN_IN_QUERY.test(read(path));
}

function layoutTags(source: string): string[] {
  return [...source.matchAll(/<Layout\b[^>]*>/g)].map((match) => match[0]);
}

describe("Web Analytics beacon", () => {
  const tokenPages = PAGES.filter(carriesToken);

  it("finds the pages whose URL carries a token", () => {
    expect(tokenPages.sort()).toEqual(
      expect.arrayContaining([
        "apps/web/src/pages/invite/[token].astro",
        "apps/web/src/pages/reset-password.astro",
        "apps/web/src/pages/unsubscribe.astro",
      ])
    );
  });

  it("is never loaded on a page whose URL carries a token", () => {
    const leaking = tokenPages.filter((path) => {
      const tags = layoutTags(read(path));
      return (
        tags.length === 0 ||
        tags.some((tag) => !/\banalytics=\{false\}/.test(tag))
      );
    });
    expect(
      leaking,
      "render <Layout analytics={false}> on pages whose URL carries a token"
    ).toEqual([]);
  });
});
