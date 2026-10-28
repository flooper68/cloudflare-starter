import type { Clock } from "../kernel";
import { sendMessage } from "../platform";
import { type HelloMessage, helloMessageSchema } from "./domain";

/** Queues a hello for the background consumer. */
export async function sendHello(
  deps: { readonly queue: Queue<HelloMessage>; readonly clock: Clock },
  input: {
    readonly name: string;
    readonly userId: string;
    /** The caller's W3C traceparent; the consumer continues that trace. */
    readonly traceparent?: string;
  }
): Promise<void> {
  await sendMessage(deps.queue, helloMessageSchema, {
    type: "hello",
    name: input.name,
    userId: input.userId,
    queuedAt: deps.clock.now().toISOString(),
    ...(input.traceparent ? { traceparent: input.traceparent } : {}),
  });
}
