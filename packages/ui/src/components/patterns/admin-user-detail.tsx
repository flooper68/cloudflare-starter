import {
  Ban,
  KeyRound,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  VenetianMask,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { useConfirm } from "../alert-dialog";
import { Avatar } from "../avatar";
import { Badge } from "../badge";
import { Button } from "../button";
import { Card } from "../card";
import { DescriptionItem, DescriptionList } from "../description-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { Field } from "../field";
import { Select, SelectItem } from "../select";
import { Skeleton, SkeletonText } from "../skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { Textarea } from "../textarea";
import { RelativeTime } from "../timeline";

export interface AdminSessionRow {
  readonly id: string;
  readonly createdAt: Date | string;
  readonly lastActiveAt: Date | string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly impersonatedBy: string | null;
}

export interface AdminUserDetailData {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly role: "user" | "admin";
  readonly ban: {
    readonly active: boolean;
    readonly reason: string | null;
    readonly expiresAt: Date | string | null;
  };
  readonly signInMethods: readonly string[];
  readonly createdAt: Date | string;
  readonly lastSeenAt: Date | string | null;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: "personal" | "shared";
    readonly role: string;
  }[];
  readonly sessions: readonly AdminSessionRow[];
}

/** What a suspension asks for: a reason for other admins and when it ends (null: never). */
export interface AdminBanInput {
  readonly reason: string;
  readonly expiresAt: Date | null;
}

/** Each action resolves when done; the page refreshes and reports errors (toast, reauth). */
export interface AdminUserActions {
  readonly onBan: (input: AdminBanInput) => Promise<void>;
  readonly onUnban: () => Promise<void>;
  readonly onResetSecondFactor?: () => Promise<void>;
  readonly onRevokeSessions: () => Promise<void>;
  readonly onSetRole: (role: "user" | "admin") => Promise<void>;
  readonly onSendPasswordReset: () => Promise<void>;
  readonly onImpersonate: () => Promise<void>;
  readonly onRemove: () => Promise<void>;
}

export interface AdminUserDetailProps extends AdminUserActions {
  readonly user: AdminUserDetailData;
  /** The signed-in admin is looking at their own account: no actions. */
  readonly isSelf: boolean;
  /** Called with a workspace id when its name is clicked. */
  readonly onOpenWorkspace?: (workspaceId: string) => void;
  /** Opens the ban dialog on load (docs and tests). */
  readonly defaultBanOpen?: boolean;
}

const METHOD_LABELS: Readonly<Record<string, string>> = {
  credential: "Email + password",
  google: "Google",
};

const DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "permanent", label: "Until lifted" },
] as const;

function BanDialog({
  name,
  open,
  onOpenChange,
  onBan,
}: {
  readonly name: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onBan: (input: AdminBanInput) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<string>("7");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      const days = duration === "permanent" ? null : Number(duration);
      await onBan({
        reason: reason.trim(),
        expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
      });
      onOpenChange(false);
      setReason("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form noValidate onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>Suspend {name}?</DialogTitle>
            <DialogDescription>
              They are signed out everywhere, including MCP clients, and cannot
              sign in until the suspension ends or is lifted.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field
              label="Reason"
              description="Visible to admins in the audit log."
            >
              <Textarea
                rows={3}
                maxLength={200}
                placeholder="Sent spam invitations"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Field label="Duration">
              <Select value={duration} onValueChange={setDuration}>
                {DURATIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={sending}>
              Suspend
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One user in the admin portal: profile, status, sign-in methods, workspaces and open
 * sessions, with the admin actions. Destructive actions ask first; the component reports
 * intents and the page calls the API, shows its errors and asks for a fresh sign-in when
 * the API wants one. Admins and suspended users cannot be impersonated; nothing is
 * offered on your own account.
 */
export function AdminUserDetail({
  user,
  isSelf,
  onOpenWorkspace,
  defaultBanOpen = false,
  onBan,
  onUnban,
  onRevokeSessions,
  onResetSecondFactor,
  onSetRole,
  onSendPasswordReset,
  onImpersonate,
  onRemove,
}: AdminUserDetailProps) {
  const { confirm, dialog } = useConfirm();
  const [banOpen, setBanOpen] = useState(defaultBanOpen);
  const admin = user.role === "admin";

  async function ask(
    options: Parameters<typeof confirm>[0],
    action: () => Promise<void>
  ) {
    if (await confirm(options)) await action();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Avatar
          name={user.name || user.email}
          src={user.image ?? undefined}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-fg">
              {user.name}
            </h2>
            {admin ? (
              <Badge tone="info" icon={<ShieldCheck />}>
                Admin
              </Badge>
            ) : null}
            {user.ban.active ? <Badge tone="danger">Suspended</Badge> : null}
            {isSelf ? <Badge tone="neutral">You</Badge> : null}
          </div>
          <p className="truncate text-sm text-fg-muted">{user.email}</p>
        </div>
        {isSelf ? null : (
          <div className="flex flex-wrap gap-2">
            {user.ban.active ? (
              <Button icon={<UserCheck />} onClick={() => void onUnban()}>
                Lift suspension
              </Button>
            ) : (
              <Button icon={<Ban />} onClick={() => setBanOpen(true)}>
                Suspend
              </Button>
            )}
            <Button
              icon={<VenetianMask />}
              disabled={admin || user.ban.active}
              onClick={() =>
                void ask(
                  {
                    title: `Impersonate ${user.name}?`,
                    description:
                      "You see the app as they do for up to an hour, and everything you do is done as them and recorded with your name. Stop from the banner at the top.",
                    confirmLabel: "Impersonate",
                  },
                  onImpersonate
                )
              }
            >
              Impersonate
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <DescriptionList labelWidth="10rem">
          <DescriptionItem label="Email">
            {user.email}
            {user.emailVerified ? (
              <Badge tone="success">Verified</Badge>
            ) : (
              <Badge tone="warning">Unverified</Badge>
            )}
          </DescriptionItem>
          <DescriptionItem label="Sign-in methods">
            {user.signInMethods.length
              ? user.signInMethods
                  .map((method) => METHOD_LABELS[method] ?? method)
                  .join(", ")
              : "None"}
          </DescriptionItem>
          <DescriptionItem label="Joined">
            <RelativeTime date={user.createdAt} />
          </DescriptionItem>
          <DescriptionItem label="Last seen">
            {user.lastSeenAt ? (
              <RelativeTime date={user.lastSeenAt} />
            ) : (
              "Never"
            )}
          </DescriptionItem>
          {user.ban.active ? (
            <DescriptionItem label="Suspended">
              {user.ban.reason ?? "No reason given"}
              {" · "}
              {user.ban.expiresAt ? (
                <>
                  ends <RelativeTime date={user.ban.expiresAt} />
                </>
              ) : (
                "until lifted"
              )}
            </DescriptionItem>
          ) : null}
          <DescriptionItem label="Workspaces">
            {user.workspaces.length === 0 ? (
              "None"
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {user.workspaces.map((workspace) => (
                  <Button
                    key={workspace.id}
                    size="xs"
                    variant="outline"
                    disabled={!onOpenWorkspace || workspace.kind === "personal"}
                    onClick={() => onOpenWorkspace?.(workspace.id)}
                  >
                    {workspace.name}
                    <span className="text-fg-muted">· {workspace.role}</span>
                  </Button>
                ))}
              </span>
            )}
          </DescriptionItem>
        </DescriptionList>
      </Card>

      {onResetSecondFactor && !isSelf ? (
        <Button
          className="self-start"
          onClick={() =>
            void ask(
              {
                title: `Reset two-factor authentication for ${user.name}?`,
                description:
                  "Their authenticator and recovery codes stop working. Every session and connected client is signed out. They must set up security again if required.",
                confirmLabel: "Reset two-factor authentication",
                tone: "danger",
              },
              onResetSecondFactor
            )
          }
        >
          Reset two-factor authentication
        </Button>
      ) : null}
      <Card className="flex flex-col p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="text-sm font-medium text-fg">
            Sessions ({user.sessions.length})
          </h3>
          {isSelf ? null : (
            <Button
              size="sm"
              icon={<LogOut />}
              disabled={user.sessions.length === 0}
              onClick={() =>
                void ask(
                  {
                    title: `Sign ${user.name} out everywhere?`,
                    description:
                      "Every session ends; a cached one within a minute. They can sign in again.",
                    confirmLabel: "Sign out everywhere",
                    tone: "danger",
                  },
                  onRevokeSessions
                )
              }
            >
              Sign out everywhere
            </Button>
          )}
        </div>
        {user.sessions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">No open sessions.</p>
        ) : (
          <Table aria-label="Sessions">
            <TableHeader>
              <TableRow>
                <TableHead>Signed in</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <RelativeTime date={session.createdAt} />
                    {session.impersonatedBy ? (
                      <Badge tone="warning" className="ml-2">
                        Impersonation
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <RelativeTime date={session.lastActiveAt} />
                  </TableCell>
                  <TableCell className="text-fg-muted tabular-nums">
                    {session.ipAddress || "Unknown"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-fg-muted">
                    {session.userAgent || "Unknown"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {isSelf ? null : (
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-medium text-fg">Account</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<KeyRound />}
              onClick={() =>
                void ask(
                  {
                    title: `Send ${user.name} a password reset link?`,
                    description: `An email goes to ${user.email}. You never see the link.`,
                    confirmLabel: "Send link",
                  },
                  onSendPasswordReset
                )
              }
            >
              Send password reset
            </Button>
            <Button
              icon={admin ? <ShieldOff /> : <ShieldCheck />}
              onClick={() =>
                void ask(
                  admin
                    ? {
                        title: `Remove ${user.name}'s admin role?`,
                        description: "They lose access to the admin portal.",
                        confirmLabel: "Remove admin role",
                        tone: "danger",
                      }
                    : {
                        title: `Make ${user.name} an admin?`,
                        description:
                          "They get the admin portal: every user, workspace and the audit log.",
                        confirmLabel: "Make admin",
                      },
                  () => onSetRole(admin ? "user" : "admin")
                )
              }
            >
              {admin ? "Remove admin role" : "Make admin"}
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 />}
              onClick={() =>
                void ask(
                  {
                    title: `Delete ${user.name}'s account?`,
                    description:
                      "Their own workspaces and files are deleted and they leave shared ones. This cannot be undone.",
                    confirmLabel: "Delete account",
                    tone: "danger",
                  },
                  onRemove
                )
              }
            >
              Delete account
            </Button>
          </div>
        </Card>
      )}

      <BanDialog
        name={user.name}
        open={banOpen}
        onOpenChange={setBanOpen}
        onBan={onBan}
      />
      {dialog}
    </div>
  );
}

/** Loading placeholder shaped like the user detail. */
export function AdminUserDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading user"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-20 rounded-lg" />
      <Card className="p-4">
        <SkeletonText lines={5} />
      </Card>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
