import { LogIn } from "lucide-react";

import { ConfirmDialog } from "../alert-dialog";

export interface AdminReauthDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Signs out and goes to sign-in, coming back to this page afterwards. */
  readonly onSignIn: () => void;
}

/**
 * Asked when a destructive admin action needs a fresh sign-in (the API answered
 * REAUTH_REQUIRED): explains why and offers to sign in again.
 */
export function AdminReauthDialog({
  open,
  onOpenChange,
  onSignIn,
}: AdminReauthDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onSignIn}
      title={
        <span className="flex items-center gap-2">
          <LogIn aria-hidden className="size-4" />
          Sign in again to continue
        </span>
      }
      description="Suspending, deleting, signing out and changing roles need a sign-in from the last 15 minutes. Sign in again, then repeat the action."
      confirmLabel="Sign in again"
      cancelLabel="Not now"
    />
  );
}
