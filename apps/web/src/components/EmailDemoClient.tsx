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
    setStatus("Sending Mailjet test email to your signed-in Clerk address...");

    try {
      await trpc.email.sendTest.mutate();
      setStatus(
        "Email sent. If sandbox mode is enabled, Mailjet validated it without delivery."
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
        <CardTitle>Mailjet Test Email</CardTitle>
        <CardDescription>
          Send a test email to the current Clerk user. The provider integration
          stays behind a small email service interface.
        </CardDescription>
      </div>

      <Button disabled={sending} onClick={sendEmail} type="button">
        {sending ? "Sending..." : "Send test email"}
      </Button>

      <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
        {status}
      </div>
    </Card>
  );
}
