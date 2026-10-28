import type { HelloMessage } from "./hello-message";

/**
 * Log attributes for a consumed hello message (OpenTelemetry `app.*` keys; the event name,
 * user, environment and trace ids come from the logger).
 */
export function helloGreeting(message: HelloMessage) {
  return {
    "app.greeting.message": `Hello, ${message.name}`,
    "app.greeting.queued_at": message.queuedAt,
  } as const;
}
