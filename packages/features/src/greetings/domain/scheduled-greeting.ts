/** The structured log line for one run of the cron demo. */
export function scheduledGreeting(input: {
  readonly environment: string;
  readonly cron: string;
  readonly scheduledTime: number;
}) {
  return {
    tag: "cron-hello",
    message: "Hello from cron",
    environment: input.environment,
    cron: input.cron,
    scheduledTime: new Date(input.scheduledTime).toISOString(),
  } as const;
}
