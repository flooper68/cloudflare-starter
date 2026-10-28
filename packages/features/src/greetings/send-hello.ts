import type { Clock } from "../kernel";
import { sendMessage } from "../platform";
import { type HelloMessage, helloMessageSchema } from "./domain";

/** Queues a hello for the background consumer. */
export async function sendHello(
  deps: { readonly queue: Queue<HelloMessage>; readonly clock: Clock },
  input: {
    readonly name: string;
    readonly userId: string;
    /** The caller's request id; the consumer reuses it for its logs and errors. */
    readonly requestId?: string;
  }
): Promise<void> {
  await sendMessage(deps.queue, helloMessageSchema, {
    type: "hello",
    name: input.name,
    userId: input.userId,
    queuedAt: deps.clock.now().toISOString(),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });
}
