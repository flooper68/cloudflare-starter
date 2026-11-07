import { CircleAlert, MailCheck, MailOpen } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Logo } from "../../brand/brand";
import { Button } from "../button";
import { Callout } from "../callout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../card";
import { errorMessage } from "../error-state";
import { RateLimitNotice } from "../rate-limit-notice";

/** What a resend request came back with: sent, or refused for a while (HTTP 429). */
export type ResendResult =
  | { readonly status: "sent" }
  | { readonly status: "rate-limited"; readonly retryAfterSeconds: number };

function Header({
  icon,
  title,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <CardHeader>
      <Logo className="mb-3" />
      <span className="mb-2 flex size-9 items-center justify-center rounded-lg border border-line bg-surface-raised text-fg-muted [&_svg]:size-5">
        {icon}
      </span>
      <CardTitle level={1}>{title}</CardTitle>
      <p className="text-sm text-fg-muted">{children}</p>
    </CardHeader>
  );
}

export interface CheckInboxCardProps {
  /** Where the link went; omitted when the page does not know it. */
  readonly email?: string;
  /** Hours the link stays valid (Better Auth's default is one hour). */
  readonly expiresInHours?: number;
  /** Sends the link again; reject with a message-bearing error to show it. */
  readonly onResend: () => Promise<ResendResult>;
  /** "Use another email": back to the sign-up form, or the account settings. */
  readonly onUseAnotherEmail?: () => void;
  readonly useAnotherEmailHref?: string;
}

/**
 * "Check your inbox": shown after sign-up when the address must be verified, and to a
 * signed-in user whose address is not verified yet. Resend is rate limited by the
 * server; a 429 shows the wait, then lets the user try again.
 */
export function CheckInboxCard({
  email,
  expiresInHours = 1,
  onResend,
  onUseAnotherEmail,
  useAnotherEmailHref,
}: CheckInboxCardProps) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const result = await onResend();
      if (result.status === "rate-limited") {
        setRetryAfter(result.retryAfterSeconds);
        setSent(false);
      } else {
        setRetryAfter(null);
        setSent(true);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't send the link"));
    } finally {
      setBusy(false);
    }
  }

  const hours = expiresInHours === 1 ? "an hour" : `${expiresInHours} hours`;
  return (
    <Card className="w-full max-w-md space-y-4">
      <Header icon={<MailOpen />} title="Check your inbox">
        {email ? (
          <>
            We sent a link to <strong className="text-fg">{email}</strong>. Open
            it to finish setting up your account.
          </>
        ) : (
          "We sent you a link. Open it to finish setting up your account."
        )}
      </Header>
      <CardContent className="space-y-3">
        <Callout
          tone="info"
          description={`The link expires in ${hours}. Nothing arrived? Check spam, or send it again.`}
        />
        {retryAfter !== null ? (
          <RateLimitNotice
            retryAfterSeconds={retryAfter}
            subject="verification emails"
            retrying={busy}
            onRetry={() => resend()}
          />
        ) : null}
        {sent ? (
          <p role="status" className="text-sm text-success">
            Sent. Check your inbox again in a minute.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {retryAfter === null ? (
          <Button
            className="flex-1"
            loading={busy}
            onClick={() => void resend()}
          >
            Resend link
          </Button>
        ) : null}
        {useAnotherEmailHref ? (
          <Button asChild variant="ghost" className="flex-1">
            <a href={useAnotherEmailHref}>Use another email</a>
          </Button>
        ) : onUseAnotherEmail ? (
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onUseAnotherEmail}
          >
            Use another email
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/**
 * What the page a verification link leads to shows:
 * - `verified`: the address is confirmed.
 * - `invalid`: the link expired or is incomplete (Better Auth's `?error=`).
 */
export type EmailVerifiedState = "verified" | "invalid";

export interface EmailVerifiedCardProps {
  readonly state: EmailVerifiedState;
  /** Where "Continue to the app" goes. */
  readonly continueHref?: string;
  /** Where to ask for a new link (invalid): the check-inbox page or sign-in. */
  readonly newLinkHref?: string;
}

/** The landing page of an email verification link: confirmed, or ask for a new link. */
export function EmailVerifiedCard({
  state,
  continueHref = "/app/dashboard",
  newLinkHref = "/verify-email",
}: EmailVerifiedCardProps) {
  if (state === "invalid") {
    return (
      <Card className="w-full max-w-md space-y-4">
        <Header icon={<CircleAlert />} title="This link doesn't work">
          It expired or was cut off when it was copied. Ask for a new one.
        </Header>
        <CardFooter>
          <Button asChild variant="primary" className="w-full">
            <a href={newLinkHref}>Send a new link</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }
  return (
    <Card className="w-full max-w-md space-y-4">
      <Header icon={<MailCheck />} title="Email verified">
        Your address is confirmed. You can use the app.
      </Header>
      <CardFooter>
        <Button asChild variant="primary" className="w-full">
          <a href={continueHref}>Continue to the app</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
