import { z } from "zod";

import { defineJob } from "../../kernel";

/** Background job: someone asked to say hello. The user and time travel in the envelope. */
export const helloJob = defineJob({
  type: "greetings.hello",
  payload: z.object({ name: z.string().trim().min(1).max(100) }),
  backoff: { initialDelaySeconds: 10, maxDelaySeconds: 600, jitter: "full" },
});

export type HelloPayload = { readonly name: string };
