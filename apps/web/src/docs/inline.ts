/**
 * The inline Markdown of a changelog line (`code`, **bold**, [links](…)) as React
 * elements, without HTML strings: the release-notes page renders them statically.
 * Relative links are rewritten like the rest of the docs (links.ts).
 */
import { createElement, Fragment, type ReactNode } from "react";

import { rewriteHref } from "./links";

export type InlineToken =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "strong"; readonly children: readonly InlineToken[] }
  | {
      readonly kind: "link";
      readonly href: string;
      readonly children: readonly InlineToken[];
    };

const PATTERN = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function tokenize(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let at = 0;
  for (const match of text.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    if (index > at) tokens.push({ kind: "text", text: text.slice(at, index) });
    if (match[1] !== undefined) tokens.push({ kind: "code", text: match[1] });
    else if (match[2] !== undefined)
      tokens.push({ kind: "strong", children: tokenize(match[2]) });
    else
      tokens.push({
        kind: "link",
        href: match[4],
        children: tokenize(match[3]),
      });
    at = index + match[0].length;
  }
  if (at < text.length) tokens.push({ kind: "text", text: text.slice(at) });
  return tokens;
}

/** Plain text of a line (the feed's summaries, search). */
export function plainText(tokens: readonly InlineToken[]): string {
  return tokens
    .map((token) =>
      token.kind === "text" || token.kind === "code"
        ? token.text
        : plainText(token.children)
    )
    .join("");
}

/** React elements of a line; `from` is the file the line comes from (link rewriting). */
export function renderInline(text: string, from: string): ReactNode {
  const render = (tokens: readonly InlineToken[]): ReactNode[] =>
    tokens.map((token, index) => {
      switch (token.kind) {
        case "text":
          return createElement(Fragment, { key: index }, token.text);
        case "code":
          return createElement("code", { key: index }, token.text);
        case "strong":
          return createElement(
            "strong",
            { key: index },
            ...render(token.children)
          );
        default:
          return createElement(
            "a",
            { key: index, href: rewriteHref(from, token.href) },
            ...render(token.children)
          );
      }
    });
  return createElement(Fragment, null, ...render(tokenize(text)));
}
