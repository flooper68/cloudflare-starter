import { CircleAlert, Clock, MailCheck, UserRoundX } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Logo } from "../../brand/brand";
import { Button } from "../button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../card";
import { errorMessage } from "../error-state";

/**
 * What the invitation page shows:
 * - `valid`: signed in with the invited email; one click joins.
 * - `signed-out`: sign in or create an account with the invited email first.
 * - `wrong-account`: signed in as someone else.
 * - `expired`, `invalid` (unknown, revoked or used): ask for a new invitation.
 * - `accepted`: already joined; go to the app.
 */
export type AcceptInvitationState =
  | "valid"
  | "signed-out"
  | "wrong-account"
  | "expired"
  | "invalid"
  | "accepted";

export interface AcceptInvitationCardProps {
  readonly state: AcceptInvitationState;
  readonly workspaceName?: string;
  readonly inviterName?: string | null;
  /** The address the invitation was sent to. */
  readonly invitedEmail?: string;
  readonly role?: string;
  /** The signed-in user's email (wrong-account). */
  readonly currentEmail?: string;
  /** Joins; reject with a message-bearing error to show it. */
  readonly onAccept?: () => Promise<void>;
  /** Signs out so the user can sign in with the invited address (wrong-account). */
  readonly onSignOut?: () => void;
  readonly signInHref?: string;
  readonly signUpHref?: string;
  /** Where "Open the app" goes (accepted). */
  readonly appHref?: string;
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
 * The card on `/invite/<token>`: who invited you to which workspace, and the one next
 * step for your situation (join, sign in, switch account, or ask for a new link).
 */
export function AcceptInvitationCard({
  state,
  workspaceName = "the workspace",
  inviterName,
  invitedEmail,
  role,
  currentEmail,
  onAccept,
  onSignOut,
  signInHref = "/sign-in",
  signUpHref = "/sign-up",
  appHref = "/app",
}: AcceptInvitationCardProps) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = inviterName ? `${inviterName} invited you` : "You are invited";

  async function accept() {
    if (!onAccept) return;
    setJoining(true);
    setError(null);
    try {
      await onAccept();
    } catch (caught) {
      setError(errorMessage(caught));
      setJoining(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-4">
      {state === "valid" || state === "signed-out" ? (
        <>
          <Message icon={<MailCheck />} title={`Join ${workspaceName}`}>
            {who} to join <strong className="text-fg">{workspaceName}</strong>
            {role ? ` as ${role}` : ""}.
            {state === "signed-out"
              ? ` Sign in or create an account with ${invitedEmail ?? "the invited address"} to accept.`
              : null}
          </Message>
          <CardFooter className="flex flex-col items-stretch gap-2">
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {state === "valid" ? (
              <Button
                variant="primary"
                loading={joining}
                onClick={() => void accept()}
              >
                Accept and join
              </Button>
            ) : (
              <>
                <Button asChild variant="primary">
                  <a href={signUpHref}>Create an account</a>
                </Button>
                <Button asChild variant="secondary">
                  <a href={signInHref}>Sign in</a>
                </Button>
              </>
            )}
          </CardFooter>
        </>
      ) : null}

      {state === "wrong-account" ? (
        <>
          <Message
            icon={<UserRoundX />}
            title="This invitation is for someone else"
          >
            It was sent to {invitedEmail ?? "another address"}, and you are
            signed in as {currentEmail ?? "another account"}. Sign out, then
            sign in with the invited address.
          </Message>
          <CardFooter>
            <Button variant="primary" onClick={onSignOut}>
              Sign out
            </Button>
          </CardFooter>
        </>
      ) : null}

      {state === "expired" ? (
        <Message icon={<Clock />} title="This invitation has expired">
          Invitations work for 7 days. Ask{" "}
          {inviterName ?? "the person who invited you"} to send a new one.
        </Message>
      ) : null}

      {state === "invalid" ? (
        <Message icon={<CircleAlert />} title="This invitation is not valid">
          The link was revoked, already used or mistyped. Ask the person who
          invited you for a new one.
        </Message>
      ) : null}

      {state === "accepted" ? (
        <>
          <Message icon={<MailCheck />} title={`You're in ${workspaceName}`}>
            You have joined {workspaceName}.
          </Message>
          <CardFooter>
            <Button asChild variant="primary">
              <a href={appHref}>Open the app</a>
            </Button>
          </CardFooter>
        </>
      ) : null}
    </Card>
  );
}
