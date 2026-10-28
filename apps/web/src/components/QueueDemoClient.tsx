import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ErrorState,
  Input,
  Label,
} from "@cloudflare-starter/ui";
import { type FormEvent, useState } from "react";
import {
  errorReference,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/lib/error-reference";
import { trpc } from "@/lib/trpc/client";

export function QueueDemoClient() {
  const [name, setName] = useState("Nicole");
  const [status, setStatus] = useState("No message queued yet.");
  const [failure, setFailure] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFailure(null);
    setStatus("Sending hello message to Cloudflare Queue...");

    try {
      await trpc.queue.enqueueHello.mutate({ name });
      setStatus("Queued successfully. Check the queue worker logs for output.");
    } catch (error) {
      setFailure(error);
      setStatus("No message queued.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Queue Hello World</CardTitle>
        <CardDescription>
          Enqueue a typed hello message from the web app. The dedicated queue
          worker validates and logs the consumed payload.
        </CardDescription>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="queue-name">Name</Label>
          <Input
            id="queue-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>

        <Button disabled={submitting} type="submit">
          {submitting ? "Queueing..." : "Queue hello"}
        </Button>
      </form>

      {failure ? (
        <ErrorState
          variant="inline"
          error={failure}
          description={
            errorReference(failure) ? UNEXPECTED_ERROR_MESSAGE : undefined
          }
          reference={errorReference(failure)}
        />
      ) : (
        <div className="rounded-xl bg-surface p-4 text-sm text-fg-muted">
          {status}
        </div>
      )}
    </Card>
  );
}
