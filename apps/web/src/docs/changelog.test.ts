import { describe, expect, it } from "vitest";

import { parseChangelog, releaseId, validateChangelog } from "./changelog";

const REPO = "https://github.com/acme/starter";

const VALID = `# Changelog

Intro paragraph
over two lines.

## [Unreleased]

### Fixed

- A fix not released yet.

## [0.2.0] - 2026-12-01

Summary of 0.2.0.

### Added

- **Notes.** A new app,
  wrapped onto a second line.
- Another one with \`code\`.

### Security

- Shorter reset links.

## [0.1.0] - 2026-11-08

### Added

- The first release.

[Unreleased]: ${REPO}/compare/v0.2.0...HEAD
[0.2.0]: ${REPO}/compare/v0.1.0...v0.2.0
[0.1.0]: ${REPO}/releases/tag/v0.1.0
`;

describe("parseChangelog", () => {
  const changelog = parseChangelog(VALID);

  it("reads the title, intro, releases, groups and link references", () => {
    expect(changelog.title).toBe("Changelog");
    expect(changelog.intro).toEqual(["Intro paragraph over two lines."]);
    expect(changelog.releases.map((r) => [r.version, r.date])).toEqual([
      ["Unreleased", null],
      ["0.2.0", "2026-12-01"],
      ["0.1.0", "2026-11-08"],
    ]);
    expect(changelog.releases[1].summary).toEqual(["Summary of 0.2.0."]);
    expect(changelog.releases[1].groups).toEqual([
      {
        type: "Added",
        items: [
          "**Notes.** A new app, wrapped onto a second line.",
          "Another one with `code`.",
        ],
      },
      { type: "Security", items: ["Shorter reset links."] },
    ]);
    expect(changelog.links.get("0.1.0")).toBe(`${REPO}/releases/tag/v0.1.0`);
    expect(changelog.stray).toEqual([]);
  });

  it("gives each release a section id", () => {
    expect(releaseId("Unreleased")).toBe("unreleased");
    expect(releaseId("0.10.2")).toBe("v0-10-2");
  });
});

describe("validateChangelog", () => {
  it("accepts a well-formed changelog", () => {
    expect(validateChangelog(parseChangelog(VALID), REPO)).toEqual([]);
  });

  it("accepts an empty Unreleased section and a first release", () => {
    const source = `# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-11-08\n\n### Added\n\n- One.\n\n[Unreleased]: ${REPO}/compare/v0.1.0...HEAD\n[0.1.0]: ${REPO}/releases/tag/v0.1.0\n`;
    expect(validateChangelog(parseChangelog(source), REPO)).toEqual([]);
  });

  const broken = (from: string, to: string) =>
    validateChangelog(parseChangelog(VALID.replace(from, to)), REPO);

  it.each([
    ["# Changelog", "# Changes", /"# Changelog"/],
    ["## [Unreleased]", "## [0.3.0] - 2026-12-02", /\[Unreleased\]/],
    ["## [0.2.0] - 2026-12-01", "## [0.2] - 2026-12-01", /not a SemVer/],
    ["## [0.2.0] - 2026-12-01", "## [0.2.0] - 2026-13-01", /not a date/],
    ["## [0.2.0] - 2026-12-01", "## [0.2.0]", /YYYY-MM-DD/],
    ["## [0.2.0] - 2026-12-01", "## [0.2.0] - 2026-11-01", /dated before/],
    ["### Security", "### Improved", /not one of/],
    [
      "- Shorter reset links.",
      "- Shorter reset links.\n\n### Fixed\n\n- Later.",
      /out of order/,
    ],
    ["- Shorter reset links.", "", /no entries/],
    [
      `[0.1.0]: ${REPO}/releases/tag/v0.1.0`,
      "",
      /missing link reference \[0\.1\.0\]/,
    ],
    [`compare/v0.1.0...v0.2.0`, "compare/v0.0.9...v0.2.0", /expected/],
    [
      "- The first release.",
      "- The first release.\n  - nested",
      /unexpected line/,
    ],
  ])("refuses %j → %j", (from, to, message) => {
    expect(broken(from, to).join("\n")).toMatch(message);
  });

  it("refuses versions out of order", () => {
    const swapped = VALID.replace("## [0.2.0]", "## [0.0.5]").replace(
      "[0.2.0]:",
      "[0.0.5]:"
    );
    expect(validateChangelog(parseChangelog(swapped), REPO).join("\n")).toMatch(
      /must be newer/
    );
  });

  it("refuses a link reference that names no release", () => {
    expect(
      validateChangelog(
        parseChangelog(`${VALID}[0.0.1]: ${REPO}/x\n`),
        REPO
      ).join("\n")
    ).toMatch(/\[0\.0\.1\] names no release/);
  });
});
