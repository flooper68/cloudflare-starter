import type { Logger } from "../platform";
import { type HelloPayload, helloGreeting } from "./domain";

/** Handles a hello job: logs the greeting in the trace of the request that queued it. */
export async function sayHello(
  deps: { readonly logger: Logger },
  payload: HelloPayload,
  job: { readonly time: string }
): Promise<void> {
  deps.logger.info(
    "greetings.hello",
    helloGreeting({ name: payload.name, queuedAt: job.time })
  );
}
