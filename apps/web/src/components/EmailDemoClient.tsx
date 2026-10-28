import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ErrorState,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import {
  errorReference,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/lib/error-reference";
import { trpc } from "@/lib/trpc/client";

export function EmailDemoClient() {
  const [status, setStatus] = useState("No email sent yet.");
  const [failure, setFailure] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  async function sendEmail() {
    setSending(true);
    setFailure(null);
    setStatus("Sending a test email to your signed-in address...");

    try {
      await trpc.email.sendTest.mutate();
      setStatus(
        "Email sent. In local dev the binding is simulated: see the dev server log."
      );
    } catch (error) {
      setFailure(error);
      setStatus("No email sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="space-y-2">
        <CardTitle>Cloudflare Email Service</CardTitle>
        <CardDescription>
          Send a test email to the signed-in user. The provider integration
          stays behind a small email service interface.
        </CardDescription>
      </div>

      <Button disabled={sending} onClick={sendEmail} type="button">
        {sending ? "Sending..." : "Send test email"}
      </Button>

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
