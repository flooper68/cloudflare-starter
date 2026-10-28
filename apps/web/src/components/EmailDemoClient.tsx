import {
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

export function EmailDemoClient() {
  const [status, setStatus] = useState("No email sent yet.");
  const [sending, setSending] = useState(false);

  async function sendEmail() {
    setSending(true);
    setStatus("Sending a test email to your signed-in address...");

    try {
      await trpc.email.sendTest.mutate();
      setStatus(
        "Email sent. In local dev the binding is simulated: see the dev server log."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email failed";
      setStatus(message);
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

      <div className="rounded-xl bg-surface p-4 text-sm text-fg-muted">
        {status}
      </div>
    </Card>
  );
}
