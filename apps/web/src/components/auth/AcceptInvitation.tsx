import {
  AcceptInvitationCard,
  type AcceptInvitationState,
} from "@cloudflare-starter/ui";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

export interface AcceptInvitationProps {
  readonly token: string;
  readonly state: AcceptInvitationState;
  readonly workspaceName?: string;
  readonly inviterName?: string | null;
  readonly invitedEmail?: string;
  readonly role?: string;
  readonly currentEmail?: string;
}

/** The invitation page's island: accepts through tRPC, then opens the app in that workspace. */
export function AcceptInvitation({ token, ...props }: AcceptInvitationProps) {
  const [state, setState] = useState(props.state);
  const back = `?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <AcceptInvitationCard
      {...props}
      state={state}
      signInHref={`/sign-in${back}`}
      signUpHref={`/sign-up${back}`}
      appHref="/app/dashboard"
      onAccept={async () => {
        await trpc.workspace.invitations.accept.mutate({ token });
        setState("accepted");
        window.location.href = "/app/dashboard";
      }}
      onSignOut={() => {
        void authClient.signOut().then(() => {
          window.location.href = `/sign-in${back}`;
        });
      }}
    />
  );
}
