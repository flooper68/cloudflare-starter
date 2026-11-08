import { z } from "zod";

/** Longest title, in characters. */
export const NOTE_TITLE_MAX = 200;
/** Longest note body (plain text), in characters. */
export const NOTE_BODY_MAX = 20_000;
/** Longest comment, in characters. */
export const NOTE_COMMENT_MAX = 2_000;

const title = z
  .string()
  .trim()
  .min(1, "A note needs a title")
  .max(NOTE_TITLE_MAX);
const body = z.string().max(NOTE_BODY_MAX);

/** A new note: a title and an optional plain-text body. */
export const createNoteInputSchema = z.object({
  title,
  body: body.default(""),
});
export type CreateNoteInput = z.input<typeof createNoteInputSchema>;

/** A change to a note: the fields given replace the stored ones. */
export const updateNoteInputSchema = z
  .object({ noteId: z.uuid(), title: title.optional(), body: body.optional() })
  .refine((input) => input.title !== undefined || input.body !== undefined, {
    message: "Change the title, the body or both",
  });
export type UpdateNoteInput = z.input<typeof updateNoteInputSchema>;

/** A comment on a note. */
export const addNoteCommentInputSchema = z.object({
  noteId: z.uuid(),
  body: z.string().trim().min(1, "A comment needs text").max(NOTE_COMMENT_MAX),
});
export type AddNoteCommentInput = z.input<typeof addNoteCommentInputSchema>;

/** Listing a workspace's notes: an optional title search and a page size. */
export const listNotesInputSchema = z.object({
  query: z.string().trim().max(NOTE_TITLE_MAX).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type ListNotesInput = z.input<typeof listNotesInputSchema>;

/** Most hits one note search returns (the command palette shows a handful). */
export const NOTE_SEARCH_LIMIT_MAX = 20;

/**
 * Searching a workspace's live notes by title and body (the app's command palette): a
 * non-empty query and a small page size.
 */
export const searchNotesInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Type something to search")
    .max(NOTE_TITLE_MAX),
  limit: z.number().int().min(1).max(NOTE_SEARCH_LIMIT_MAX).default(8),
});
export type SearchNotesInput = z.input<typeof searchNotesInputSchema>;
