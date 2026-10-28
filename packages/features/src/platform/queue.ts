import type { z } from "zod";

/** Validates a message against its schema, then sends it, so a bad payload never enters the queue. */
export async function sendMessage<TSchema extends z.ZodType>(
  queue: Queue<z.infer<TSchema>>,
  schema: TSchema,
  message: z.infer<TSchema>
): Promise<void> {
  await queue.send(schema.parse(message));
}
