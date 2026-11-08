import {
  addNoteComment,
  addNoteCommentInputSchema,
  createNote,
  createNoteInputSchema,
  getNote,
  listNotes,
  listNotesInputSchema,
  trashNote,
  updateNote,
  updateNoteInputSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

import { router, workspaceProcedure } from "./init";

const noteRef = z.object({ noteId: z.uuid() });

/**
 * The placeholder Notes app: the worked example of a feature added end to end
 * (docs/guides/how-to-add-a-feature.md). Every procedure acts in one workspace and has
 * an MCP tool; mutations are limited by `mutation.user`. Deleting moves the note to the
 * trash (`trash.restore` brings it back).
 */
export const notesRouter = router({
  list: workspaceProcedure
    .input(listNotesInputSchema)
    .query(({ ctx, input }) => listNotes(ctx, ctx.actor, input)),

  get: workspaceProcedure
    .input(noteRef)
    .query(({ ctx, input }) => getNote(ctx, ctx.actor, input)),

  create: workspaceProcedure
    .input(createNoteInputSchema)
    .mutation(({ ctx, input }) => createNote(ctx, ctx.actor, input)),

  update: workspaceProcedure
    .input(updateNoteInputSchema)
    .mutation(({ ctx, input }) => updateNote(ctx, ctx.actor, input)),

  delete: workspaceProcedure
    .input(noteRef)
    .mutation(({ ctx, input }) => trashNote(ctx, ctx.actor, input)),

  comments: router({
    add: workspaceProcedure
      .input(addNoteCommentInputSchema)
      .mutation(({ ctx, input }) => addNoteComment(ctx, ctx.actor, input)),
  }),
});
