import { html } from "../../kernel";

/** The daily digest goes out at this UTC hour; the cron entry's schedule says the same. */
export const DIGEST_HOUR_UTC = 8;
export const DIGEST_SCHEDULE = `0 ${DIGEST_HOUR_UTC} * * *`;

/** One notification waiting for the digest. */
export interface DigestEntry {
  readonly type: string;
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly href: string | null;
}

export interface DigestGroup {
  readonly type: string;
  readonly label: string;
  readonly entries: readonly DigestEntry[];
}

/** Groups entries by type, in the order each type first appears. */
export function groupDigest(entries: readonly DigestEntry[]): DigestGroup[] {
  const groups = new Map<string, DigestEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.type) ?? [];
    group.push(entry);
    groups.set(entry.type, group);
  }
  return [...groups].map(([type, list]) => ({
    type,
    label: list[0]?.label ?? type,
    entries: list,
  }));
}

/** The digest mail's content (subject, text, body markup) before the mail layout. */
export function digestContent(
  entries: readonly DigestEntry[],
  appUrl: string
): { readonly subject: string; readonly text: string; readonly html: string } {
  const groups = groupDigest(entries);
  const count = entries.length;
  const subject = `Your daily summary: ${count} notification${count === 1 ? "" : "s"}`;
  const link = (href: string | null) => (href ? `${appUrl}${href}` : null);
  const text = groups
    .map(
      (group) =>
        `${group.label} (${group.entries.length})\n${group.entries
          .map((entry) => {
            const url = link(entry.href);
            return `- ${entry.title}: ${entry.body}${url ? `\n  ${url}` : ""}`;
          })
          .join("\n")}`
    )
    .join("\n\n");
  const body = html`<h1 style="font-size:18px">${subject}</h1>${groups.map(
    (group) =>
      html`<h2 style="font-size:14px">${group.label} (${group.entries.length})</h2><ul>${group.entries.map(
        (entry) => {
          const url = link(entry.href);
          return html`<li>${url ? html`<a href="${url}">${entry.title}</a>` : entry.title}: ${entry.body}</li>`;
        }
      )}</ul>`
  )}`;
  return { subject, text, html: body.value };
}

/** The UTC date of a digest run, `YYYY-MM-DD`: one digest per user and day. */
export function digestDate(asOf: Date): string {
  return asOf.toISOString().slice(0, 10);
}
