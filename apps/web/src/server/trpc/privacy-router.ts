import {
  createExportLink,
  listDataRequests,
  requestDataExport,
} from "@cloudflare-starter/features";
import { z } from "zod";
import { protectedProcedure, router } from "./init";
export const privacyRouter = router({
  requestExport: protectedProcedure
    .input(z.object({ workspaceId: z.string().min(1).optional() }).optional())
    .mutation(({ ctx, input }) => requestDataExport(ctx, ctx.user.id, input)),
  list: protectedProcedure.query(({ ctx }) =>
    listDataRequests(ctx, ctx.user.id)
  ),
  download: protectedProcedure
    .input(z.object({ requestId: z.uuid() }))
    .query(({ ctx, input }) =>
      createExportLink(
        { ...ctx, secret: ctx.config.BETTER_AUTH_SECRET },
        ctx.user.id,
        input
      )
    ),
});
