/**
 * The docs navigation, built from the docs index (docs/README.md): one section per `##`
 * heading, one item per table row whose first link names a published file, in the
 * order of the index, after the DOCS.start section (the index itself and the repository
 * README). Pure: the page passes the sources in.
 */
import { DOCS } from "./docs.config";
import { isPublished, parseRepoLink, routeFor } from "./links";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  /** Repository path of the page. */
  readonly path: string;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/** The first `# ` heading of a Markdown source, or null. */
export function docTitle(source: string): string | null {
  const match = /^#[ \t]+(.+?)[ \t#]*$/m.exec(source);
  return match ? match[1].trim() : null;
}

/** A shorter nav label: the title without a leading "How to". */
export function navLabel(title: string): string {
  const stripped = title.replace(/^how to\s+/i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

/**
 * `indexSource`: the Markdown of DOCS.navSource. `titles`: the title of each published
 * file, by repository path (files without a title use their path).
 */
export function buildNav(
  indexSource: string,
  titles: ReadonlyMap<string, string>
): NavSection[] {
  const label = (path: string) => navLabel(titles.get(path) ?? path);
  const start: NavItem[] = DOCS.start.items
    .filter((item) => isPublished(item.path))
    .map((item) => ({ ...item, href: routeFor(item.path) }));
  const sections: { title: string; items: NavItem[] }[] = [
    { title: DOCS.start.title, items: start },
  ];
  const seen = new Set(start.map((item) => item.path));
  let current: { title: string; items: NavItem[] } | null = null;

  for (const line of indexSource.split("\n")) {
    const heading = /^##[ \t]+(.+?)\s*$/.exec(line);
    if (heading) {
      current = { title: heading[1], items: [] };
      sections.push(current);
      continue;
    }
    if (!current || !line.startsWith("|")) continue;
    const firstCell = line.split("|")[1] ?? "";
    const href = LINK.exec(firstCell)?.[1];
    if (!href) continue;
    const link = parseRepoLink(DOCS.navSource, href);
    if (!link || link.folder || !isPublished(link.path) || seen.has(link.path))
      continue;
    seen.add(link.path);
    current.items.push({
      path: link.path,
      href: routeFor(link.path),
      label: label(link.path),
    });
  }
  return sections.filter((section) => section.items.length > 0);
}

/** Every page in the navigation, in order. */
export function navPaths(sections: readonly NavSection[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.path));
}

export interface PageLocation {
  readonly section: NavSection | null;
  readonly previous: NavItem | null;
  readonly next: NavItem | null;
}

/** The section of a page and its neighbours in reading order. */
export function locate(
  sections: readonly NavSection[],
  path: string
): PageLocation {
  const items = sections.flatMap((section) =>
    section.items.map((item) => ({ item, section }))
  );
  const at = items.findIndex(({ item }) => item.path === path);
  if (at === -1) return { section: null, previous: null, next: null };
  return {
    section: items[at].section,
    previous: items[at - 1]?.item ?? null,
    next: items[at + 1]?.item ?? null,
  };
}
