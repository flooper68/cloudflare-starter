import { describe, expect, it } from "vitest";

import {
  addNoteCommentInputSchema,
  createNoteInputSchema,
  listNotesInputSchema,
  NOTE_BODY_MAX,
  NOTE_COMMENT_MAX,
  NOTE_TITLE_MAX,
  updateNoteInputSchema,
} from "./note-input";

const noteId = "00000000-0000-4000-8000-000000000001";

describe("note input", () => {
  it("accepts a trimmed title and defaults the body to empty", () => {
    expect(createNoteInputSchema.parse({ title: "  Q3 launch  " })).toEqual({
      title: "Q3 launch",
      body: "",
    });
  });

  it("rejects a blank or too long title and a too long body", () => {
    expect(createNoteInputSchema.safeParse({ title: "   " }).success).toBe(
      false
    );
    expect(
      createNoteInputSchema.safeParse({ title: "x".repeat(NOTE_TITLE_MAX + 1) })
        .success
    ).toBe(false);
    expect(
      createNoteInputSchema.safeParse({
        title: "Long",
        body: "x".repeat(NOTE_BODY_MAX + 1),
      }).success
    ).toBe(false);
  });

  it("needs a change and a note id to update", () => {
    expect(updateNoteInputSchema.safeParse({ noteId }).success).toBe(false);
    expect(
      updateNoteInputSchema.safeParse({ noteId: "nope", title: "New" }).success
    ).toBe(false);
    expect(updateNoteInputSchema.parse({ noteId, body: "" })).toEqual({
      noteId,
      body: "",
    });
  });

  it("accepts a comment with text and refuses an empty or too long one", () => {
    expect(
      addNoteCommentInputSchema.parse({ noteId, body: " Booked " })
    ).toEqual({ noteId, body: "Booked" });
    expect(
      addNoteCommentInputSchema.safeParse({ noteId, body: "  " }).success
    ).toBe(false);
    expect(
      addNoteCommentInputSchema.safeParse({
        noteId,
        body: "x".repeat(NOTE_COMMENT_MAX + 1),
      }).success
    ).toBe(false);
  });

  it("lists 50 by default and at most 100", () => {
    expect(listNotesInputSchema.parse({})).toEqual({ limit: 50 });
    expect(listNotesInputSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
