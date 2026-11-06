/**
 * Page metadata of a docs page: the meta description is the doc's first paragraph (every
 * doc starts with its purpose, docs/processes/documentation.md), as plain text, cut at a
 * word boundary to fit search result snippets.
 */

const MAX_LENGTH = 160;

/** Markdown inline syntax to plain text: link text, code without backticks, no bold. */
function plain(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** The first paragraph after the title, or null when the doc starts otherwise. */
export function docDescription(source: string): string | null {
  const lines = source.split("\n");
  let index = 0;
  // Skip up to and including the title, then blank lines.
  const title = lines.findIndex((line) => /^#[ \t]/.test(line));
  if (title !== -1) index = title + 1;
  while (index < lines.length && lines[index].trim() === "") index++;
  const paragraph: string[] = [];
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") break;
    if (
      paragraph.length === 0 &&
      /^\s*(#|\||```|~~~|[-*+] |\d+\. |>|<)/.test(line)
    )
      return null;
    paragraph.push(line);
  }
  const text = plain(paragraph.join(" "));
  return text ? shorten(text, MAX_LENGTH) : null;
}
