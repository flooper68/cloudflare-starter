/** Who wrote or changed a note; null once that account is deleted. */
export interface NotePerson {
  readonly userId: string;
  readonly name: string;
}

/** A stored note joined with its people's names, as the use cases read it. */
export interface NoteRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdBy: string | null;
  readonly createdByName: string | null;
  readonly createdAt: Date;
  readonly updatedBy: string | null;
  readonly updatedByName: string | null;
  readonly updatedAt: Date;
}

/** What the list and the API return for a note. */
export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  /** The first line of the body, at most 140 characters, for the list. */
  readonly excerpt: string;
  readonly createdBy: NotePerson | null;
  readonly createdAt: string;
  readonly updatedBy: NotePerson | null;
  readonly updatedAt: string;
  readonly commentCount: number;
}

const EXCERPT_MAX = 140;

/** The first non-empty line of a body, cut at EXCERPT_MAX with an ellipsis. */
export function noteExcerpt(body: string): string {
  const line =
    body
      .split("\n")
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "";
  return line.length > EXCERPT_MAX
    ? `${line.slice(0, EXCERPT_MAX - 1)}…`
    : line;
}

function person(userId: string | null, name: string | null): NotePerson | null {
  return userId && name !== null ? { userId, name } : null;
}

/** A row as the API returns it: ISO dates, people, an excerpt and the comment count. */
export function toNoteSummary(row: NoteRow, commentCount: number): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    excerpt: noteExcerpt(row.body),
    createdBy: person(row.createdBy, row.createdByName),
    createdAt: row.createdAt.toISOString(),
    updatedBy: person(row.updatedBy, row.updatedByName),
    updatedAt: row.updatedAt.toISOString(),
    commentCount,
  };
}
