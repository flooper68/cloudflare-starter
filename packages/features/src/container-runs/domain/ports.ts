/**
 * What starting a run needs from outside the feature: a way to start its workflow. The
 * web app implements it with the CONTAINER_RUN_WORKFLOW Workflows binding
 * (apps/web/src/server/container-run-workflow.ts); tests pass a recording fake.
 */
export interface ContainerRunWorkflows {
  /** Starts the workflow of `runId` (also its instance id). Throws when it cannot. */
  start(input: { readonly runId: string }): Promise<void>;
}
