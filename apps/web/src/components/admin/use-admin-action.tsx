import { AdminReauthDialog, toast } from "@cloudflare-starter/ui";
import { type ReactElement, useState } from "react";

import { authClient } from "@/lib/auth-client";

/** The API's stable error code (DomainError `code`, tRPC `data.appCode`). */
function appCodeOf(error: unknown): string | undefined {
  return (error as { data?: { appCode?: string } } | null)?.data?.appCode;
}

export interface AdminAction {
  /**
   * Runs an admin mutation: a toast on success, the reauth prompt when the API asks for
   * a fresh sign-in (REAUTH_REQUIRED), else a toast with the error. Resolves either way.
   */
  readonly run: (
    action: () => Promise<unknown>,
    done: string
  ) => Promise<boolean>;
  /** Render once in the page. */
  readonly dialog: ReactElement;
}

export function useAdminAction(): AdminAction {
  const [reauth, setReauth] = useState(false);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      return true;
    } catch (error) {
      if (appCodeOf(error) === "REAUTH_REQUIRED") {
        setReauth(true);
      } else {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong"
        );
      }
      return false;
    }
  }

  return {
    run,
    dialog: (
      <AdminReauthDialog
        open={reauth}
        onOpenChange={setReauth}
        onSignIn={() => {
          const next = `${window.location.pathname}${window.location.search}`;
          void authClient.signOut().finally(() => {
            window.location.href = `/sign-in?next=${encodeURIComponent(next)}`;
          });
        }}
      />
    ),
  };
}
