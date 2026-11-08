import {
  containerRunRefSchema,
  getContainerRun,
  listContainerRuns,
  listContainerRunsInputSchema,
  startContainerRun,
  startContainerRunInputSchema,
} from "@cloudflare-starter/features";

import { router, workspaceProcedure } from "./init";

/**
 * The container workflow demo (docs/guides/how-to-run-container-workflows.md): start a run
 * (or retry a failed one), read one, list the workspace's runs with whether the demo takes
 * a new one now. Every procedure acts in one workspace and has an MCP tool; `start` is
 * limited by `container.run` (a few a minute per user) besides the use case's hourly limit
 * and daily cap.
 */
export const containerRunsRouter = router({
  start: workspaceProcedure
    .input(startContainerRunInputSchema)
    .mutation(({ ctx, input }) =>
      startContainerRun(
        {
          ...ctx,
          settings: ctx.config.containerDemo,
          workflows: ctx.containerRunWorkflows,
        },
        ctx.actor,
        input
      )
    ),

  get: workspaceProcedure
    .input(containerRunRefSchema)
    .query(({ ctx, input }) => getContainerRun(ctx, ctx.actor, input)),

  list: workspaceProcedure
    .input(listContainerRunsInputSchema)
    .query(({ ctx, input }) =>
      listContainerRuns(
        { ...ctx, settings: ctx.config.containerDemo },
        ctx.actor,
        input
      )
    ),
});
