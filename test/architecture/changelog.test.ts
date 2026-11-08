/**
 * CHANGELOG.md keeps the Keep a Changelog 1.1 structure the release-notes page, its
 * feed and the release steps rely on (docs/processes/development.md#changelog):
 * headings, SemVer versions, dates, group names and order, link references.
 */
import { describe, expect, it } from "vitest";

import {
  CHANGELOG_PATH,
  parseChangelog,
  validateChangelog,
} from "@/docs/changelog";
import { DOCS } from "@/docs/docs.config";
import { isPublished } from "@/docs/links";
import { buildNav, navPaths } from "@/docs/nav";

import { read } from "./repo";

describe("CHANGELOG.md", () => {
  const changelog = parseChangelog(read(CHANGELOG_PATH));

  it("follows Keep a Changelog and Semantic Versioning", () => {
    expect(validateChangelog(changelog, DOCS.repoUrl)).toEqual([]);
  });

  it("has at least one release (the checks above are not vacuous)", () => {
    // A project starts with Unreleased only (starter:strip resets the changelog).
    expect(changelog.releases.length).toBeGreaterThan(0);
    expect(
      changelog.releases.some((release) =>
        release.groups.some((group) => group.items.length > 0)
      )
    ).toBe(true);
  });

  it("is published on the docs site and in its navigation", () => {
    expect(isPublished(CHANGELOG_PATH)).toBe(true);
    // Its own section of the docs navigation (docs/README.md, "## Changelog").
    const nav = buildNav(read(DOCS.navSource), new Map());
    expect(navPaths(nav)).toContain(CHANGELOG_PATH);
  });
});
