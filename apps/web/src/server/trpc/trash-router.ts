import {
  emptyTrash,
  listTrash,
  purgeItems,
  restoreItems,
  TRASH_CATALOG,
  trashItemsInputSchema,
  trashListInputSchema,
} from "@cloudflare-starter/features";

import { router, workspaceProcedure } from "./init";

/**
 * The workspace's trash: every trashable entity of TRASH_CATALOG (files today). Moving
 * something to the trash is its own feature's procedure (`storage.deleteFile`); the
 * daily `trash.purge-expired` job deletes what is past retention.
 */
export const trashRouter = router({
  list: workspaceProcedure.input(trashListInputSchema).query(({ ctx, input }) =>
    listTrash({ ...ctx, entities: TRASH_CATALOG }, ctx.actor, {
      type: input.type,
      cursor: input.cursor,
      limit: input.limit,
    })
  ),

  restore: workspaceProcedure
    .input(trashItemsInputSchema)
    .mutation(({ ctx, input }) =>
      restoreItems({ ...ctx, entities: TRASH_CATALOG }, ctx.actor, {
        items: input.items,
      })
    ),

  deletePermanently: workspaceProcedure
    .input(trashItemsInputSchema)
    .mutation(({ ctx, input }) =>
      purgeItems({ ...ctx, entities: TRASH_CATALOG }, ctx.actor, {
        items: input.items,
      })
    ),

  empty: workspaceProcedure.mutation(({ ctx }) =>
    emptyTrash({ ...ctx, entities: TRASH_CATALOG }, ctx.actor)
  ),
});
