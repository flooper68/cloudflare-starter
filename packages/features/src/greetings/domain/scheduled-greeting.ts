/**
 * Log attributes for one run of the cron demo (OpenTelemetry `app.*` keys; the event name,
 * environment and trace ids come from the logger).
 */
export function scheduledGreeting(input: {
  readonly cron: string;
  readonly scheduledTime: number;
}) {
  return {
    "app.greeting.message": "Hello from cron",
    "app.cron.schedule": input.cron,
    "app.cron.scheduled_time": new Date(input.scheduledTime).toISOString(),
  } as const;
}
