/**
 * /docs/changelog.xml: an Atom feed of the releases in CHANGELOG.md, prerendered.
 * URLs are absolute with SITE_URL; without it (local builds) they use the repository's
 * GitHub address so the feed stays valid. docs/processes/development.md#changelog
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
  const base = site ?? new URL(`${DOCS.repoUrl}/`);
  const pageUrl = site
    ? new URL("/docs/changelog/", base).href
    : `${DOCS.repoUrl}/blob/${DOCS.branch}/${CHANGELOG_PATH}`;
  const feedUrl = site
    ? new URL("/docs/changelog.xml", base).href
    : `${DOCS.repoUrl}/blob/${DOCS.branch}/${CHANGELOG_PATH}`;
  return new Response(
    changelogFeed(parseChangelog(source), {
      title: `${DOCS.siteName} changelog`,
      pageUrl,
      feedUrl,
      repoUrl: DOCS.repoUrl,
    }),
    { headers: { "content-type": "application/atom+xml; charset=utf-8" } }
  );
};
