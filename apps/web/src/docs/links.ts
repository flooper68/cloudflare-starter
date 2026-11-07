/**
 * Where repository files live on the docs site, and how a link written for GitHub (a
 * relative path between files) becomes a link that works on the site: a published
 * Markdown file becomes its /docs page, anything else its GitHub URL. Pure, so the
 * Markdown plugin (links-plugin.ts), the navigation and the architecture test share it.
 */
import { DOCS } from "./docs.config";

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function globToRegExp(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      // `**/` matches any number of folders, including none.
      pattern += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else {
      pattern += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

const SOURCE_PATTERNS = DOCS.sources.map(globToRegExp);

/** True when the repository file (path from the root) is a page of the site. */
export function isPublished(path: string): boolean {
  return SOURCE_PATTERNS.some((pattern) => pattern.test(path));
}

/** The URL segment after /docs/ of a published file ("" for the docs index). */
export function slugFor(path: string): string {
  const override = DOCS.routes[path];
  if (override !== undefined) return override;
  return path
    .replace(/\.md$/i, "")
    .replace(/^docs(\/|$)/, "")
    .replace(/(^|\/)README$/i, "")
    .toLowerCase();
}

/** The page URL of a published file, with a trailing slash (the served form). */
export function routeFor(path: string): string {
  const slug = slugFor(path);
  return slug ? `/docs/${slug}/` : "/docs/";
}

/** "Edit this page on GitHub" for a published file. */
export function editUrl(path: string): string {
  return `${DOCS.repoUrl}/edit/${DOCS.branch}/${path}`;
}

/** The file (or folder, `tree`) on GitHub. */
export function githubUrl(
  path: string,
  kind: "blob" | "tree" = "blob"
): string {
  return `${DOCS.repoUrl}/${kind}/${DOCS.branch}/${path}`;
}

/**
 * Resolves `target` (a relative path) against the folder of `from` (a repository file),
 * POSIX style. Null when the result leaves the repository.
 */
export function resolveRepoPath(from: string, target: string): string | null {
  const parts = from.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

/** A link split into the repository path it names and its `#fragment`. */
export interface RepoLink {
  /** Repository path from the root ("" for the root folder). */
  readonly path: string;
  /** The fragment without `#`, or null. */
  readonly anchor: string | null;
  /** The link pointed at a folder (`dir/`). */
  readonly folder: boolean;
}

/**
 * The repository file a relative link in `from` points at, or null for links that are
 * not relative repository links: absolute URLs, `mailto:`, site paths (`/app`), pure
 * `#fragments` and paths leaving the repository.
 */
export function parseRepoLink(from: string, href: string): RepoLink | null {
  if (
    !href ||
    SCHEME.test(href) ||
    href.startsWith("/") ||
    href.startsWith("#")
  )
    return null;
  const hashAt = href.indexOf("#");
  const target = hashAt === -1 ? href : href.slice(0, hashAt);
  const anchor = hashAt === -1 ? null : href.slice(hashAt + 1);
  const queryAt = target.indexOf("?");
  const clean = queryAt === -1 ? target : target.slice(0, queryAt);
  const path = resolveRepoPath(from, decodeURI(clean));
  if (path === null) return null;
  return {
    path,
    anchor: anchor || null,
    folder: clean === "" || clean.endsWith("/"),
  };
}

/**
 * The site URL for a link written in the repository file `from`. Relative links to a
 * published Markdown file become its /docs page (keeping the fragment); relative links
 * to any other file or folder become its GitHub URL; everything else is unchanged.
 */
export function rewriteHref(from: string, href: string): string {
  const link = parseRepoLink(from, href);
  if (!link) return href;
  const hash = link.anchor ? `#${link.anchor}` : "";
  if (!link.folder && isPublished(link.path)) return routeFor(link.path) + hash;
  if (link.path === "") return DOCS.repoUrl;
  return githubUrl(link.path, link.folder ? "tree" : "blob") + hash;
}
