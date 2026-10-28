import type { HelloMessage } from "./hello-message";

/** The structured log line for a consumed hello message. */
export function helloGreeting(message: HelloMessage, environment: string) {
  return {
    tag: "queue-hello",
    environment,
    message: `Hello, ${message.name}`,
    userId: message.userId,
    queuedAt: message.queuedAt,
  } as const;
}
