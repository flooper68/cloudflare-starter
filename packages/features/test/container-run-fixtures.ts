import { env } from "cloudflare:workers";

import {
  type Actor,
  beginContainerRunStep,
  type ContainerDemoSettings,
  type RunStepName,
  startContainerRun,
} from "../src";
import { useCaseDeps } from "./fixtures";

/** A ContainerRunWorkflows that records the runs it was asked to start, or fails. */
export function recordingWorkflows(options: { readonly fail?: boolean } = {}) {
  const started: string[] = [];
  return {
    started,
    async start({ runId }: { readonly runId: string }) {
      if (options.fail) throw new Error("workflow binding unavailable");
      started.push(runId);
    },
  };
}

/** useCaseDeps plus the demo's settings (on, cap 50, fake runner) and a recording workflow. */
export function containerDeps(
  overrides: {
    readonly at?: string;
    readonly settings?: Partial<ContainerDemoSettings>;
    readonly failWorkflow?: boolean;
  } = {}
) {
  const workflows = recordingWorkflows({ fail: overrides.failWorkflow });
  return {
    ...useCaseDeps(overrides.at),
    bucket: env.FILES,
    settings: {
      mode: "on",
      dailyCap: 50,
      runner: "fake",
      ...overrides.settings,
    } satisfies ContainerDemoSettings,
    workflows,
  };
}

/** Starts a run of `digits` as `actor` and returns its id. */
export async function startRun(
  actor: Actor,
  digits: 1000 | 10_000 | 50_000 = 1000,
  at?: string
): Promise<string> {
  const { runId } = await startContainerRun(containerDeps({ at }), actor, {
    digits,
  });
  return runId;
}

/** Moves a run through the given steps, as its workflow would. */
export async function advanceRun(
  runId: string,
  steps: readonly RunStepName[],
  at?: string
): Promise<void> {
  const deps = containerDeps({ at });
  for (const step of steps) {
    await beginContainerRunStep(deps, { runId, step });
  }
}
