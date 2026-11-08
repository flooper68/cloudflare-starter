import { describe, expect, it } from "vitest";

import { parseChangelog } from "./changelog";
import { changelogFeed } from "./changelog-feed";

const SOURCE = `# Changelog

## [Unreleased]

### Added

- Not in the feed yet.

## [0.2.0] - 2026-12-01

### Added

- **Notes** <script>alert(1)</script> and [a guide](docs/guides/how-to-setup-d1.md).

## [0.1.0] - 2026-11-08

### Added

- The first release.
`;

describe("changelogFeed", () => {
  const xml = changelogFeed(parseChangelog(SOURCE), {
    title: "Starter changelog",
    pageUrl: "https://starter.example.com/docs/changelog/",
    feedUrl: "https://starter.example.com/docs/changelog.xml",
    repoUrl: "https://github.com/acme/starter",
    sectionLinks: true,
  });

  it("lists the released versions, newest first, not Unreleased", () => {
    const titles = [...xml.matchAll(/<entry>\s*<title>([^<]+)<\/title>/g)].map(
      (match) => match[1]
    );
    expect(titles).toEqual(["0.2.0", "0.1.0"]);
    expect(xml).not.toContain("Not in the feed yet");
    expect(xml).toContain("<updated>2026-12-01T00:00:00Z</updated>");
  });

  it("links each entry to its section and identifies it by its tag", () => {
    expect(xml).toContain(
      'href="https://starter.example.com/docs/changelog/#v0-2-0"'
    );
    expect(xml).toContain(
      "<id>https://github.com/acme/starter/releases/tag/v0.2.0</id>"
    );
  });

  it("escapes the content twice (HTML in XML) and makes links absolute", () => {
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&amp;lt;script&amp;gt;");
    expect(xml).toContain(
      "https://starter.example.com/docs/guides/how-to-setup-d1/"
    );
  });

  it("without a site address has no self link and links entries to the file", () => {
    const local = changelogFeed(parseChangelog(SOURCE), {
      title: "Starter changelog",
      pageUrl: "https://github.com/acme/starter/blob/main/CHANGELOG.md",
      repoUrl: "https://github.com/acme/starter",
    });
    expect(local).not.toContain('rel="self"');
    expect(local).not.toContain("CHANGELOG.md#");
  });
});
