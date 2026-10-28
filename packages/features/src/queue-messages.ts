// Composition root for the queue: every message type any feature sends on APP_QUEUE.
import { z } from "zod";

import { helloMessageSchema } from "./greetings";

export const queueMessageSchema = z.discriminatedUnion("type", [
  helloMessageSchema,
]);

export type QueueMessage = z.infer<typeof queueMessageSchema>;
