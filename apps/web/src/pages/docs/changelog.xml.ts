/**
 * /docs/changelog.xml: an Atom feed of the releases in CHANGELOG.md, prerendered.
 * URLs are absolute with SITE_URL (set for production); without it the feed has no self
 * link and its entries link to the file on GitHub. docs/processes/development.md#changelog
 */

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { CHANGELOG_PATH, parseChangelog } from "@/docs/changelog";
import { changelogFeed } from "@/docs/changelog-feed";
import { DOCS } from "@/docs/docs.config";

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection("docs");
  const source =
    entries.find((entry) => entry.id === CHANGELOG_PATH)?.body ?? "";
  const pageUrl = site
    ? new URL("/docs/changelog/", site).href
    : `${DOCS.repoUrl}/blob/${DOCS.branch}/${CHANGELOG_PATH}`;
  const feedUrl = site ? new URL("/docs/changelog.xml", site).href : undefined;
  return new Response(
    changelogFeed(parseChangelog(source), {
      title: `${DOCS.siteName} changelog`,
      pageUrl,
      feedUrl,
      sectionLinks: Boolean(site),
      repoUrl: DOCS.repoUrl,
    }),
    { headers: { "content-type": "application/atom+xml; charset=utf-8" } }
  );
};
