import { UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "../button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { errorMessage } from "../error-state";
import { Field } from "../field";
import { Input } from "../input";
import { Select, SelectItem } from "../select";
import type { RoleOption } from "./members-table";

export interface InviteDialogProps {
  readonly roles: readonly RoleOption[];
  readonly defaultRole: string;
  /** Sends the invitation; reject with a message-bearing error to show it in the dialog. */
  readonly onInvite: (invitation: {
    readonly email: string;
    readonly role: string;
  }) => Promise<void>;
  /** Name of the workspace, for the description. */
  readonly workspaceName?: string;
  readonly defaultOpen?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Invite people": a button that opens a dialog asking for an email and a role. Checks
 * the address before sending, shows the API's error inline (already a member, not
 * allowed) and closes after a successful send; the app shows a toast.
 */
export function InviteDialog({
  roles,
  defaultRole,
  onInvite,
  workspaceName,
  defaultOpen = false,
}: InviteDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setEmail("");
      setRole(defaultRole);
      setFieldError(null);
      setError(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!EMAIL.test(email.trim())) {
      setFieldError("Enter an email address like ada@example.com");
      return;
    }
    setFieldError(null);
    setSending(true);
    try {
      await onInvite({ email: email.trim(), role });
      reset(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="primary" icon={<UserPlus />}>
          Invite people
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <form noValidate onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>
              {workspaceName
                ? `They get an email with a link to join ${workspaceName}. The link works for 7 days.`
                : "They get an email with a link to join. The link works for 7 days."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Email" error={fieldError}>
              <Input
                type="email"
                autoComplete="off"
                placeholder="ada@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Role">
              <Select value={role} onValueChange={setRole}>
                {roles.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => reset(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={sending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
