# Background jobs, schedules and email

::reviewed{date="2026-11-08"}

Do slow work after the response: send email, build exports, end trials. Jobs retry on their own and never run twice, schedules live in one list, and email works locally with nothing to set up.

::video{id="platform" poster="queue-demo" title="App platform in 75 seconds"}

## Where to find it

::shot{id="queue-demo" alt="The background jobs demo"}

::shot{id="email-demo" alt="The email demo"}

## How it works

::flow[Action or schedule -> Job queue -> Job runs -> Retry, then dead-letter]{title="Job flow: an action or a schedule enqueues a job, it runs, a failure retries and, after the last try, lands in the dead-letter queue"}

- A job is typed: a name, a checked payload and a handler. The only way onto the queue is `enqueueJob`.
- An idempotency key stops a retried or repeated job from running twice for 7 days.
- After the last retry a job lands in a dead-letter queue, kept 14 days for replay.
- Schedules are one catalog; a test checks it against the deployed config.
- Email goes through one port: the Cloudflare binding when deployed, a simulation locally.

## Turn it on

Jobs and schedules are on. Email needs a sender address on a domain you own when deployed:

:::settings
- EMAIL_FROM = none The sender address; blank turns email off
- EMAIL_FROM_NAME = none The sender's display name

:::

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-email skill to send email from production as noreply@<my domain>:
onboard the sender domain, set EMAIL_FROM, and send a test mail to me.
```
:::

:::byhand
1. `bun run setup:email --env production` checks the sender domain and writes `EMAIL_FROM`.
2. Deploy, then send a test from `/app/email-demo`.

Locally there is nothing to do: mail is logged by the dev server and saved under `apps/web/.wrangler/tmp/email/`.
:::

## Use it

:::tabs
```ts title="Add a job"
export const sendWelcomeJob = defineJob({
  type: "accounts.send-welcome",
  payload: z.object({ userId: z.string() }),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 3600, jitter: "full" },
  idempotencyKey: (payload) => payload.userId,
});
// Register the handler in job-catalog.ts, then from a use case:
await enqueueJob(deps, sendWelcomeJob, { userId }, { context });
```
```bash title="curl"
# Run a schedule locally (dev server running)
curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=17+3+*+*+*"
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "send_test_email", "arguments": {} }
}
```
:::

:::decision{title="Jobs or Workflows"}
Jobs fit short steps (seconds) with retries. A long, multi-step process that must resume after each step is a Workflow ([jobs or Workflows](../reference/background-jobs.md#jobs-or-workflows)).
:::

:::gotcha{title="A job that isn't in the catalog is dropped"}
Register the handler in `packages/features/src/job-catalog.ts`; an unknown job is acknowledged and reported, not retried.
:::

## Limits

- Email: about 3,000 mails a month are included in the Workers Paid plan.
- A job attempt must fit the queue consumer's time limits.

## Related

- [Add background jobs](../guides/how-to-add-background-jobs.md)
- [Set up email](../guides/how-to-setup-email.md)
- [Notifications](notifications.md)
