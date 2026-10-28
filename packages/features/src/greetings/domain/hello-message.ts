import { z } from "zod";

/** Queue message: someone asked to say hello in the background. */
export const helloMessageSchema = z.object({
  type: z.literal("hello"),
  name: z.string().min(1).max(100),
  userId: z.string().min(1),
  queuedAt: z.iso.datetime(),
});

export type HelloMessage = z.infer<typeof helloMessageSchema>;
