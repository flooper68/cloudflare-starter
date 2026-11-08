import type { HTMLAttributes, Ref } from "react";

import { cn } from "../lib/utils";

const proseClasses = [
  "min-w-0 text-sm text-fg [overflow-wrap:anywhere]",
  // Flow: one rhythm for every block.
  "[&>*+*]:mt-4",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-fg",
  "[&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg",
  "[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-fg",
  "[&_h4]:mt-6 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-fg",
  "[&_:is(h1,h2,h3,h4)]:scroll-mt-20",
  "[&_p]:leading-6 [&_li]:leading-6",
  "[&_a]:text-accent-text [&_a]:underline [&_a]:decoration-line-strong [&_a]:underline-offset-2",
  "[&_a:hover]:decoration-current",
  "[&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-focus",
  "[&_strong]:font-semibold [&_strong]:text-fg",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:pl-5 [&_:is(ul,ol)_:is(ul,ol)]:mt-1",
  "[&_li+li]:mt-1 [&_li::marker]:text-fg-subtle",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:text-fg-muted",
  "[&_hr]:border-line",
  // Inline code and code blocks (Shiki's colours: styles/prose.css).
  "[&_code]:font-mono [&_code]:text-[0.92em]",
  "[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-active [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface-raised [&_pre]:p-3 [&_pre]:text-xs [&_pre]:leading-5",
  "[&_pre:focus-visible]:outline-none [&_pre:focus-visible]:ring-2 [&_pre:focus-visible]:ring-focus",
  // Tables: a scroll box around each (see the JSDoc), quiet rows.
  "[&_[data-table-scroll]]:overflow-x-auto [&_[data-table-scroll]]:rounded-lg [&_[data-table-scroll]]:border [&_[data-table-scroll]]:border-line [&_[data-table-scroll]]:bg-surface-raised",
  "[&_[data-table-scroll]:focus-visible]:outline-none [&_[data-table-scroll]:focus-visible]:ring-2 [&_[data-table-scroll]:focus-visible]:ring-focus",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
  "[&_th]:border-b [&_th]:border-line [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-fg-muted",
  "[&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_tr:last-child>td]:border-b-0",
  "[&_td]:min-w-32 [&_td:first-child]:min-w-40",
  // Diagrams: an inline SVG at its width up to the column, scrolling on phones.
  "[&_[data-docs-diagram]]:overflow-x-auto [&_[data-docs-diagram]]:rounded-lg",
  "[&_[data-docs-diagram]:focus-visible]:outline-none [&_[data-docs-diagram]:focus-visible]:ring-2 [&_[data-docs-diagram]:focus-visible]:ring-focus",
  "[&_[data-docs-diagram]_svg]:block [&_[data-docs-diagram]_svg]:h-auto [&_[data-docs-diagram]_svg]:w-full [&_[data-docs-diagram]_svg]:min-w-xl",
  // Generated from Mermaid (data-natural-width): its own size, so wide diagrams scroll rather than shrink their text.
  "[&_[data-docs-diagram]_svg[data-natural-width]]:w-auto [&_[data-docs-diagram]_svg[data-natural-width]]:min-w-0 [&_[data-docs-diagram]_svg[data-natural-width]]:max-w-none",
].join(" ");

export interface ProseProps extends HTMLAttributes<HTMLDivElement> {
  readonly ref?: Ref<HTMLDivElement>;
}

/**
 * Typography for rendered Markdown (the docs site): headings, lists, links, tables,
 * inline code and Shiki code blocks in both themes, all from tokens. Wrap each table in
 * a `<section>` with `data-table-scroll`, `tabindex="0"` and a unique `aria-label`, so
 * a wide table scrolls in its own box and keyboard users can scroll it. A diagram is an
 * inline `<svg>` in a `<figure data-docs-diagram>` with the same tab stop and a label; it
 * fills the column, unless it has `data-natural-width` (diagrams generated from Mermaid),
 * which keeps its own size and scrolls.
 */
export function Prose({ className, ...props }: ProseProps) {
  return <div className={cn(proseClasses, className)} {...props} />;
}
