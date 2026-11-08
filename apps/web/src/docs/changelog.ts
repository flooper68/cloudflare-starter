/**
 * The root CHANGELOG.md (Keep a Changelog 1.1, Semantic Versioning) as data: parsed for
 * the release-notes page (src/pages/docs/changelog.astro) and its Atom feed, and checked
 * by test/architecture/changelog.test.ts. Pure: callers pass the Markdown in.
 * docs/processes/development.md#changelog
 */

export const CHANGELOG_PATH = "CHANGELOG.md";
export const UNRELEASED = "Unreleased";

/** Keep a Changelog's change types, in the order a release lists them. */
export const CHANGE_TYPES = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface ChangeGroup {
  readonly type: string;
  /** One Markdown line per bullet (continuation lines joined with a space). */
  readonly items: readonly string[];
}

export interface Release {
  /** `Unreleased` or a version such as `0.1.0`. */
  readonly version: string;
  /** `YYYY-MM-DD`, or null for Unreleased. */
  readonly date: string | null;
  /** Paragraphs between the release heading and its first group. */
  readonly summary: readonly string[];
  readonly groups: readonly ChangeGroup[];
  /** The raw heading text, for error messages. */
  readonly heading: string;
}

export interface Changelog {
  readonly title: string | null;
  readonly intro: readonly string[];
  readonly releases: readonly Release[];
  /** Link reference definitions at the bottom: label → URL. */
  readonly links: ReadonlyMap<string, string>;
  /** Lines the parser did not understand, for the structure test. */
  readonly stray: readonly string[];
}

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RELEASE_HEADING = /^## \[([^\]]+)\](?: - (\S+))?\s*$/;
const LINK_DEFINITION = /^\[([^\]]+)\]:\s*(\S+)\s*$/;

function paragraphs(lines: readonly string[]): string[] {
  return lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function parseChangelog(source: string): Changelog {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let title: string | null = null;
  const intro: string[] = [];
  const releases: {
    version: string;
    date: string | null;
    heading: string;
    summary: string[];
    groups: { type: string; items: string[] }[];
  }[] = [];
  const links = new Map<string, string>();
  const stray: string[] = [];

  for (const line of lines) {
    const definition = LINK_DEFINITION.exec(line);
    if (definition) {
      links.set(definition[1], definition[2]);
      continue;
    }
    if (/^# /.test(line)) {
      if (title === null && releases.length === 0) title = line.slice(2).trim();
      else stray.push(line);
      continue;
    }
    const release = RELEASE_HEADING.exec(line);
    if (release) {
      releases.push({
        version: release[1],
        date: release[2] ?? null,
        heading: line.slice(3).trim(),
        summary: [],
        groups: [],
      });
      continue;
    }
    if (/^## /.test(line)) {
      stray.push(line);
      continue;
    }
    const current = releases.at(-1);
    if (!current) {
      intro.push(line);
      continue;
    }
    const group = /^### (.+?)\s*$/.exec(line);
    if (group) {
      current.groups.push({ type: group[1], items: [] });
      continue;
    }
    const lastGroup = current.groups.at(-1);
    if (!lastGroup) {
      current.summary.push(line);
      continue;
    }
    if (/^- /.test(line)) {
      lastGroup.items.push(line.slice(2).trim());
    } else if (/^\s{2,}\S/.test(line) && lastGroup.items.length > 0) {
      // A continuation of the bullet (a wrapped line), not a nested list.
      if (/^\s+[-*+] /.test(line)) stray.push(line);
      else lastGroup.items[lastGroup.items.length - 1] += ` ${line.trim()}`;
    } else if (line.trim() !== "") {
      stray.push(line);
    }
  }

  return {
    title,
    intro: paragraphs(intro),
    releases: releases.map((release) => ({
      ...release,
      summary: paragraphs(release.summary),
    })),
    links,
    stray,
  };
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split(/[-+]/)[0].split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The tag of a version: `v0.1.0`. */
export const tagOf = (version: string) => `v${version}`;

/**
 * Every rule the changelog must follow, as messages (empty when it is valid): the
 * title, one Unreleased section first, then versions in descending SemVer order with
 * valid, non-increasing dates, groups only of Keep a Changelog's types and in their
 * order, no empty group, and a link reference per release pointing at the right
 * compare or tag URL of `repoUrl`, with no other references.
 */
export function validateChangelog(
  changelog: Changelog,
  repoUrl: string
): string[] {
  const problems: string[] = [];
  if (changelog.title !== "Changelog")
    problems.push('the first heading must be "# Changelog"');
  for (const line of changelog.stray)
    problems.push(`unexpected line: ${JSON.stringify(line)}`);

  const [first, ...versions] = changelog.releases;
  if (first?.version !== UNRELEASED || first.date !== null)
    problems.push(
      "the first release section must be ## [Unreleased], without a date"
    );
  for (const release of versions) {
    if (release.version === UNRELEASED)
      problems.push("there must be only one ## [Unreleased] section");
    else if (!SEMVER.test(release.version))
      problems.push(
        `${release.heading}: ${release.version} is not a SemVer version`
      );
    if (release.version !== UNRELEASED && !release.date)
      problems.push(`${release.heading}: a release needs " - YYYY-MM-DD"`);
    else if (release.date && !isDate(release.date))
      problems.push(
        `${release.heading}: ${release.date} is not a date (YYYY-MM-DD)`
      );
    if (release.groups.length === 0)
      problems.push(
        `${release.heading}: a release needs at least one ### group`
      );
  }
  for (let i = 1; i < versions.length; i++) {
    const [newer, older] = [versions[i - 1], versions[i]];
    if (!SEMVER.test(newer.version) || !SEMVER.test(older.version)) continue;
    if (compareVersions(newer.version, older.version) <= 0)
      problems.push(
        `${newer.version} must be newer than the ${older.version} below it`
      );
    if (newer.date && older.date && newer.date < older.date)
      problems.push(`${newer.version} is dated before ${older.version}`);
  }

  for (const release of changelog.releases) {
    let lastIndex = -1;
    const seen = new Set<string>();
    for (const group of release.groups) {
      const index = CHANGE_TYPES.indexOf(group.type as ChangeType);
      if (index === -1)
        problems.push(
          `${release.heading}: ### ${group.type} is not one of ${CHANGE_TYPES.join(", ")}`
        );
      else if (index < lastIndex)
        problems.push(
          `${release.heading}: ### ${group.type} is out of order (${CHANGE_TYPES.join(", ")})`
        );
      if (seen.has(group.type))
        problems.push(`${release.heading}: ### ${group.type} appears twice`);
      seen.add(group.type);
      lastIndex = Math.max(lastIndex, index);
      if (group.items.length === 0)
        problems.push(`${release.heading}: ### ${group.type} has no entries`);
    }
  }

  // Link references: Unreleased compares the latest tag with HEAD, each version its
  // previous tag with its own, the oldest links its tag.
  const expected = new Map<string, string>();
  const tagged = versions.map((release) => release.version);
  expected.set(
    UNRELEASED,
    tagged.length > 0
      ? `${repoUrl}/compare/${tagOf(tagged[0])}...HEAD`
      : `${repoUrl}/commits/HEAD`
  );
  tagged.forEach((version, index) => {
    const previous = tagged[index + 1];
    expected.set(
      version,
      previous
        ? `${repoUrl}/compare/${tagOf(previous)}...${tagOf(version)}`
        : `${repoUrl}/releases/tag/${tagOf(version)}`
    );
  });
  for (const [label, url] of expected) {
    const actual = changelog.links.get(label);
    if (actual === undefined)
      problems.push(`missing link reference [${label}]: ${url}`);
    else if (actual !== url)
      problems.push(`link reference [${label}] is ${actual}, expected ${url}`);
  }
  for (const label of changelog.links.keys())
    if (!expected.has(label))
      problems.push(`link reference [${label}] names no release`);

  return problems;
}

/** The id of a release's section on the page: `unreleased`, `v0-1-0`. */
export function releaseId(version: string): string {
  return version === UNRELEASED
    ? "unreleased"
    : `v${version.replace(/[^0-9A-Za-z]+/g, "-")}`;
}
