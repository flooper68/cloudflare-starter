import { BellOff, CircleAlert, MailX } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Logo } from "../../brand/brand";
import { Button } from "../button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../card";
import { errorMessage } from "../error-state";

/**
 * What the unsubscribe page shows:
 * - `confirm`: the link is valid; one click stops the mail it names.
 * - `done`: unsubscribed.
 * - `invalid`: the link is malformed or no longer valid.
 */
export type UnsubscribeState = "confirm" | "done" | "invalid";

export interface UnsubscribeCardProps {
  readonly state: UnsubscribeState;
  /** What the mail was about ("Someone joins a workspace you manage"), or null for all. */
  readonly topic?: string | null;
  /** Unsubscribes; reject with a message-bearing error to show it. */
  readonly onConfirm?: () => Promise<void>;
  /** Where the notification settings are (sign-in required). */
  readonly preferencesHref?: string;
}

function Message({
  icon,
  title,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <>
      <CardHeader>
        <Logo className="mb-3" />
        <span className="mb-2 flex size-9 items-center justify-center rounded-lg border border-line bg-surface-raised text-fg-muted [&_svg]:size-5">
          {icon}
        </span>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-fg-muted">{children}</CardContent>
    </>
  );
}

/**
 * The card on `/unsubscribe`, where a notification mail's link leads: opening the link
 * never unsubscribes (mail scanners open links); the button does. Mail clients that
 * support one-click unsubscribe (RFC 8058) skip this page.
 */
export function UnsubscribeCard({
  state,
  topic,
  onConfirm,
  preferencesHref = "/app/notifications/preferences",
}: UnsubscribeCardProps) {
  const [current, setCurrent] = useState<UnsubscribeState>(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const what = topic ? `mail about "${topic}"` : "notification mail";

  async function confirm() {
    if (!onConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setCurrent("done");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-4">
      {current === "confirm" ? (
        <>
          <Message icon={<MailX />} title="Unsubscribe?">
            You will stop getting {what}. You still see it in the app, and
            security notices about your account are always sent.
          </Message>
          <CardFooter className="flex flex-col items-stretch gap-2">
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button
              variant="primary"
              loading={busy}
              onClick={() => void confirm()}
            >
              Unsubscribe
            </Button>
            <Button asChild variant="ghost">
              <a href={preferencesHref}>Choose in notification settings</a>
            </Button>
          </CardFooter>
        </>
      ) : null}

      {current === "done" ? (
        <>
          <Message icon={<BellOff />} title="You are unsubscribed">
            You will no longer get {what}. Turn it back on any time in your
            notification settings.
          </Message>
          <CardFooter>
            <Button asChild variant="secondary">
              <a href={preferencesHref}>Notification settings</a>
            </Button>
          </CardFooter>
        </>
      ) : null}

      {current === "invalid" ? (
        <>
          <Message icon={<CircleAlert />} title="This link is not valid">
            The unsubscribe link is incomplete or no longer valid. Change which
            mail you get in your notification settings instead.
          </Message>
          <CardFooter>
            <Button asChild variant="secondary">
              <a href={preferencesHref}>Notification settings</a>
            </Button>
          </CardFooter>
        </>
      ) : null}
    </Card>
  );
}
