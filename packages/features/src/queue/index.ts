import { z } from "zod";

export const helloQueueMessageSchema = z.object({
  type: z.literal("hello"),
  name: z.string().min(1).max(100),
  userId: z.uuid(),
  queuedAt: z.string().datetime(),
});

export const appQueueMessageSchema = z.discriminatedUnion("type", [
  helloQueueMessageSchema,
]);

export type AppQueueMessage = z.infer<typeof appQueueMessageSchema>;

export async function enqueueAppMessage(
  queue: Queue<AppQueueMessage>,
  message: AppQueueMessage
): Promise<void> {
  await queue.send(appQueueMessageSchema.parse(message));
}

export function parseQueueMessage(value: unknown): AppQueueMessage {
  return appQueueMessageSchema.parse(value);
}
