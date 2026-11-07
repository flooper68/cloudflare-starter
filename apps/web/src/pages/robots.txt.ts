/**
 * /robots.txt, prerendered. Only a production build (CLOUDFLARE_ENV=production) may be
 * crawled, and then not the app, the API, the admin portal, Storybook or the health
 * endpoints; every other environment disallows everything. The sitemap is listed when
 * the build knows the site's origin (SITE_URL). docs/guides/how-to-publish-docs-and-landing.md
 */
import type { APIRoute } from "astro";

import { robotsTxt } from "@/docs/robots";

export const prerender = true;

export const GET: APIRoute = ({ site }) =>
  new Response(
    robotsTxt({
      indexable: import.meta.env.SITE_INDEXABLE === true,
      site: site ?? null,
    }),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
