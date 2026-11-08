import { describe, expect, it } from "vitest";

import { parseChangelog } from "@/docs/changelog";

import { shorten, whatsNew } from "./whats-new";

const SOURCE = `# Changelog

Intro.

## [Unreleased]

### Added

- **Connected agents.** People see every \`agent\` they allowed.
- An entry without a bold title.

### Changed

- **New brand.** A teal accent.

## [0.1.0] - 2026-11-08

The first release.

### Added

- **Everything.** All of it.

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
`;

describe("whatsNew", () => {
  it("takes the newest titled entries, newest release first", () => {
    const cards = whatsNew(parseChangelog(SOURCE));
    expect(cards.map((card) => card.title)).toEqual([
      "Connected agents",
      "New brand",
      "Everything",
    ]);
    expect(cards[0]).toMatchObject({
      version: "Unreleased",
      text: "People see every agent they allowed.",
      href: "/docs/changelog/#unreleased",
    });
    expect(cards[2]).toMatchObject({
      version: "0.1.0",
      date: "2026-11-08",
      href: "/docs/changelog/#v0-1-0",
    });
  });

  it("stops at the count", () => {
    expect(whatsNew(parseChangelog(SOURCE), 1)).toHaveLength(1);
  });
});

describe("shorten", () => {
  it("cuts at a word boundary with an ellipsis", () => {
    expect(shorten("one two three four", 12)).toBe("one two…");
    expect(shorten("short", 12)).toBe("short");
  });
});
