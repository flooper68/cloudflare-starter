/**
 * The home page's "What's new" cards, read from CHANGELOG.md at build time: the newest
 * entries whose line starts with a bold title (`- **Connected agents.** …`), newest
 * release first, each linking to its release on /docs/changelog/.
 */
import { type Changelog, releaseId } from "@/docs/changelog";
import { plainText, tokenize } from "@/docs/inline";

export interface NewsCard {
  readonly version: string;
  readonly date: string | null;
  readonly title: string;
  readonly text: string;
  readonly href: string;
}

const TITLED = /^\*\*(.+?)\*\*\s*(.*)$/;

/** Cuts plain text to `max` characters at a word boundary, with an ellipsis. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,.;:(]+$/, "")}…`;
}

export function whatsNew(changelog: Changelog, count = 3): NewsCard[] {
  const cards: NewsCard[] = [];
  for (const release of changelog.releases) {
    for (const group of release.groups) {
      for (const item of group.items) {
        const match = TITLED.exec(item);
        if (!match) continue;
        cards.push({
          version: release.version,
          date: release.date,
          title: plainText(tokenize(match[1])).replace(/\.$/, ""),
          text: shorten(plainText(tokenize(match[2])), 120),
          href: `/docs/changelog/#${releaseId(release.version)}`,
        });
        if (cards.length === count) return cards;
      }
    }
  }
  return cards;
}
