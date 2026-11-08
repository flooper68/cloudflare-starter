/**
 * The Atom feed of the changelog (src/pages/docs/changelog.xml.ts): one entry per
 * released version, newest first, its changes as escaped HTML. Pure.
 */
import { type Changelog, releaseId, tagOf } from "./changelog";
import { type InlineToken, tokenize } from "./inline";
import { rewriteHref } from "./links";

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inlineHtml(tokens: readonly InlineToken[], base: string): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case "text":
          return escapeXml(token.text);
        case "code":
          return `<code>${escapeXml(token.text)}</code>`;
        case "strong":
          return `<strong>${inlineHtml(token.children, base)}</strong>`;
        default: {
          const href = new URL(rewriteHref("CHANGELOG.md", token.href), base)
            .href;
          return `<a href="${escapeXml(href)}">${inlineHtml(token.children, base)}</a>`;
        }
      }
    })
    .join("");
}

export interface FeedOptions {
  readonly title: string;
  /** Absolute URL of the release-notes page. */
  readonly pageUrl: string;
  /**
   * Absolute URL of the feed itself, and whether `pageUrl` is the release-notes page
   * (entries then link to their section). Without a site address the feed has no self
   * link and entries link to the file.
   */
  readonly feedUrl?: string;
  readonly sectionLinks?: boolean;
  /** The repository, for stable entry ids (the release tags). */
  readonly repoUrl: string;
}

export function changelogFeed(
  changelog: Changelog,
  options: FeedOptions
): string {
  const released = changelog.releases.filter((release) => release.date);
  const updated = released[0]?.date ?? "1970-01-01";
  const entries = released.map((release) => {
    const html = [
      ...release.summary.map(
        (paragraph) =>
          `<p>${inlineHtml(tokenize(paragraph), options.pageUrl)}</p>`
      ),
      ...release.groups.map(
        (group) =>
          `<h3>${escapeXml(group.type)}</h3><ul>${group.items
            .map(
              (item) =>
                `<li>${inlineHtml(tokenize(item), options.pageUrl)}</li>`
            )
            .join("")}</ul>`
      ),
    ].join("");
    const link = options.sectionLinks
      ? `${options.pageUrl}#${releaseId(release.version)}`
      : options.pageUrl;
    return [
      "  <entry>",
      `    <title>${escapeXml(release.version)}</title>`,
      `    <id>${escapeXml(`${options.repoUrl}/releases/tag/${tagOf(release.version)}`)}</id>`,
      `    <link rel="alternate" type="text/html" href="${escapeXml(link)}"/>`,
      `    <updated>${release.date}T00:00:00Z</updated>`,
      `    <content type="html">${escapeXml(html)}</content>`,
      "  </entry>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(options.title)}</title>`,
    `  <id>${escapeXml(options.feedUrl ?? options.pageUrl)}</id>`,
    ...(options.feedUrl
      ? [
          `  <link rel="self" type="application/atom+xml" href="${escapeXml(options.feedUrl)}"/>`,
        ]
      : []),
    `  <link rel="alternate" type="text/html" href="${escapeXml(options.pageUrl)}"/>`,
    `  <updated>${updated}T00:00:00Z</updated>`,
    `  <author><name>${escapeXml(options.title)}</name></author>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}
