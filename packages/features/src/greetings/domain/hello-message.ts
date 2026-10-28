import { z } from "zod";

import { TRACEPARENT_PATTERN } from "../../kernel";

/** Queue message: someone asked to say hello in the background. */
export const helloMessageSchema = z.object({
  type: z.literal("hello"),
  name: z.string().min(1).max(100),
  userId: z.string().min(1),
  queuedAt: z.iso.datetime(),
  /**
   * W3C Trace Context of the request that queued it, so the consumer continues the same
   * trace (same trace id, so the same reference, in its logs and errors).
   */
  traceparent: z.string().regex(TRACEPARENT_PATTERN).optional(),
});

export type HelloMessage = z.infer<typeof helloMessageSchema>;
