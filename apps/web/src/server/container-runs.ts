/**
 * The container workflow demo's adapters in the web Worker
 * (docs/guides/how-to-run-container-workflows.md): starting a run's Workflow through the
 * CONTAINER_RUN_WORKFLOW binding, and the pi computer CONTAINER_DEMO_RUNNER picks (the pi
 * container Worker through PI_CONTAINER_SERVICE, or the in-Worker fake).
 */
import {
  type ContainerDemoSettings,
  type ContainerRunWorkflows,
  createContainerPiComputer,
  createFakePiComputer,
  type PiComputer,
} from "@cloudflare-starter/features";

import { ConfigError } from "@/lib/config";
import type { AppEnv } from "@/server/env";

/** How long Workflows keeps a finished instance: the runs' own retention. */
export const WORKFLOW_RETENTION = "7 days";

/** The fake container's stand-in for start-up and compute time, so the timeline moves visibly. */
const FAKE_DELAY_MS = 600;

/**
 * Starts a run's Workflow instance (its id is the run id). Throws a ConfigError naming the
 * binding when CONTAINER_DEMO=on and CONTAINER_RUN_WORKFLOW is not bound; with the demo off
 * nothing is started (the use case refuses before it gets here).
 */
export function containerRunWorkflowsFor(
  env: Pick<AppEnv, "CONTAINER_RUN_WORKFLOW">
): ContainerRunWorkflows {
  return {
    async start({ runId }) {
      const workflow = env.CONTAINER_RUN_WORKFLOW;
      if (!workflow) {
        throw new ConfigError(
          "CONTAINER_RUN_WORKFLOW",
          "CONTAINER_DEMO=on needs the CONTAINER_RUN_WORKFLOW workflows binding in this environment of apps/web/wrangler.jsonc"
        );
      }
      await workflow.create({
        id: runId,
        params: { runId },
        retention: {
          successRetention: WORKFLOW_RETENTION,
          errorRetention: WORKFLOW_RETENTION,
        },
      });
    },
  };
}

/** The pi computer of CONTAINER_DEMO_RUNNER; `container` needs PI_CONTAINER_SERVICE. */
export function piComputerFor(
  env: Pick<AppEnv, "PI_CONTAINER_SERVICE">,
  settings: ContainerDemoSettings
): PiComputer {
  if (settings.runner === "fake") {
    return createFakePiComputer({ delayMs: FAKE_DELAY_MS });
  }
  if (!env.PI_CONTAINER_SERVICE) {
    throw new ConfigError(
      "PI_CONTAINER_SERVICE",
      "CONTAINER_DEMO_RUNNER=container needs the PI_CONTAINER_SERVICE service binding to the pi container Worker (apps/container) in this environment of apps/web/wrangler.jsonc"
    );
  }
  return createContainerPiComputer({ service: env.PI_CONTAINER_SERVICE });
}

/** Which of the container's instances (max_instances: 2) a run uses, from its id. */
export function containerInstanceOf(runId: string): number {
  return Number.parseInt(runId.slice(-1), 16) % 2 || 0;
}
