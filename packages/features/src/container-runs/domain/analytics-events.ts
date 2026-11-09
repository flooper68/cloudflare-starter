import { z } from "zod";

import { defineEvent } from "../../kernel";

/** A container run was started (the container workflow demo): its preset and whether it retries one. */
export const containerRunStartedEvent = defineEvent(
  "container_runs.started",
  { strings: ["digits", "kind"], numbers: [] },
  z
    .object({
      digits: z.enum(["1000", "10000", "50000"]),
      kind: z.enum(["new", "retry"]),
    })
    .strict(),
  {
    client: false,
    description:
      "A container workflow demo run was started; its digits preset and whether it retries a failed run",
  }
);
