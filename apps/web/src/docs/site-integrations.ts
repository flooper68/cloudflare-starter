/**
 * Build-time integrations of the public pages (astro.config.mjs): the Pagefind index of
 * the docs, and the sitemap when the build knows the site's origin (`site`, from
 * SITE_URL). Without SITE_URL a build warns and skips the sitemap; canonical and Open
 * Graph URLs are then left out too (layouts/PublicLayout.astro).
 */
import sitemap from "@astrojs/sitemap";
import type { AstroIntegration } from "astro";

import { docsSearch } from "./search-integration";

/** Sitemap entries: the public pages a search engine should list. */
export function inSitemap(page: string): boolean {
  const { pathname } = new URL(page);
  return pathname === "/" || pathname.startsWith("/docs/");
}

const missingSite: AstroIntegration = {
  name: "site-url",
  hooks: {
    "astro:config:setup": ({ command, logger }) => {
      if (command === "build")
        logger.warn(
          "SITE_URL is not set: no sitemap, canonical or og:url (docs/guides/how-to-publish-docs-and-landing.md)"
        );
    },
  },
};

export function siteIntegrations(site: string | undefined): AstroIntegration[] {
  return [docsSearch(), site ? sitemap({ filter: inSitemap }) : missingSite];
}
