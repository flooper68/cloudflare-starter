/**
 * Turns a Pagefind result into what the search dialog shows (search.ts). Pure, so it is
 * unit tested without a browser.
 */

export interface SearchResult {
  readonly url: string;
  readonly title: string;
  /** HTML: the page text, escaped by Pagefind, with only <mark> tags kept. */
  readonly excerpt: string;
  /** The navigation section of the page (`data-pagefind-meta="section:…"`), or null. */
  readonly section: string | null;
}

/** Drops every tag but <mark> and </mark> from a Pagefind excerpt. */
export function safeExcerpt(excerpt: string): string {
  return excerpt.replace(/<(?!\/?mark>)[^>]*>/gi, "");
}

export function toResult(data: {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
}): SearchResult {
  return {
    url: data.url,
    title: data.meta.title?.trim() || data.url,
    excerpt: safeExcerpt(data.excerpt),
    section: data.meta.section?.trim() || null,
  };
}

/** The label at the end of a result row. */
export function sectionLabel(result: SearchResult): string {
  return result.section ?? "Docs";
}
