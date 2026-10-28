/**
 * Log attributes for a hello job that ran (OpenTelemetry `app.*` keys; the event name,
 * user, environment and trace ids come from the logger).
 */
export function helloGreeting(input: {
  readonly name: string;
  readonly queuedAt: string;
}) {
  return {
    "app.greeting.message": `Hello, ${input.name}`,
    "app.greeting.queued_at": input.queuedAt,
  } as const;
}
