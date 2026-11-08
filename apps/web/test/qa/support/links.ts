/** Every http(s) link of a mail, from its HTML hrefs and its text, deduplicated, in order. */
export function extractLinks(
  text: string | null,
  html: string | null
): string[] {
  const found: string[] = [];
  for (const match of (html ?? "").matchAll(/href\s*=\s*(["'])(.*?)\1/gi)) {
    found.push(decodeEntities(match[2] as string));
  }
  for (const match of (text ?? "").matchAll(/https?:\/\/[^\s<>"')\]]+/g)) {
    found.push(match[0]);
  }
  return [...new Set(found.filter((link) => /^https?:\/\//i.test(link)))];
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * The first link to `origin` whose path starts with `pathPrefix`. Throws when there is
 * none, or when the mail links the same path on another origin (a mail that points away
 * from the environment under test is a failure, and the suite never follows it).
 */
export function linkTo(
  links: readonly string[],
  origin: string,
  pathPrefix: string
): string {
  const matching = links.filter((link) => {
    try {
      return new URL(link).pathname.startsWith(pathPrefix);
    } catch {
      return false;
    }
  });
  const foreign = matching.filter((link) => new URL(link).origin !== origin);
  if (foreign.length > 0) {
    throw new Error(
      `the mail links ${pathPrefix} on another origin than ${origin}: ${foreign.map((link) => new URL(link).origin).join(", ")}`
    );
  }
  const link = matching[0];
  if (!link) throw new Error(`the mail has no ${origin}${pathPrefix} link`);
  return link;
}
