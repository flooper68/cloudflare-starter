import { Mail } from "lucide-react";

import { useConfirm } from "../alert-dialog";
import { Avatar } from "../avatar";
import { Badge } from "../badge";
import { Button } from "../button";
import { Select, SelectItem } from "../select";
import { SkeletonListRow } from "../skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

export interface MemberRow {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: "pending" | "expired";
}

export interface RoleOption {
  readonly value: string;
  readonly label: string;
}

export interface MembersTableProps {
  readonly members: readonly MemberRow[];
  /** Open invitations, listed after the members (owners only). */
  readonly invitations?: readonly InvitationRow[];
  readonly roles: readonly RoleOption[];
  /** The signed-in user; their row says "You" and offers no remove. */
  readonly currentUserId: string;
  /** Whether the signed-in user may change roles, remove members and revoke invitations. */
  readonly canManage: boolean;
  readonly onChangeRole?: (userId: string, role: string) => void;
  readonly onRemove?: (userId: string) => void;
  readonly onRevoke?: (invitationId: string) => void;
}

/**
 * The people in a workspace: name, email and role per member, then open invitations.
 * Managers get a role picker, "Remove" (confirmed first) and "Revoke". The table only
 * reports intents; the app calls the API and shows its errors (the last owner rule).
 */
export function MembersTable({
  members,
  invitations = [],
  roles,
  currentUserId,
  canManage,
  onChangeRole,
  onRemove,
  onRevoke,
}: MembersTableProps) {
  const { confirm, dialog } = useConfirm();
  const roleLabel = (value: string) =>
    roles.find((role) => role.value === value)?.label ?? value;

  async function remove(member: MemberRow) {
    const confirmed = await confirm({
      title: `Remove ${member.name}?`,
      description: `${member.email} loses access to this workspace and its files.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (confirmed) onRemove?.(member.userId);
  }

  return (
    <>
      <Table aria-label="Members">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-40">Role</TableHead>
            {canManage ? (
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const you = member.userId === currentUserId;
            return (
              <TableRow key={member.userId}>
                <TableCell>
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={member.name || member.email} size="sm" />
                    <span className="truncate font-medium">{member.name}</span>
                    {you ? <Badge tone="neutral">You</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="text-fg-muted">{member.email}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      size="sm"
                      aria-label={`Role of ${member.name}`}
                      value={member.role}
                      onValueChange={(role) =>
                        onChangeRole?.(member.userId, role)
                      }
                    >
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </Select>
                  ) : (
                    roleLabel(member.role)
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    {you ? null : (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => void remove(member)}
                      >
                        Remove<span className="sr-only"> {member.name}</span>
                      </Button>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <span className="flex items-center gap-2 text-fg-muted">
                  <Mail aria-hidden className="size-4" />
                  <Badge
                    tone={invitation.status === "expired" ? "warning" : "info"}
                  >
                    {invitation.status === "expired" ? "Expired" : "Invited"}
                  </Badge>
                </span>
              </TableCell>
              <TableCell className="text-fg-muted">
                {invitation.email}
              </TableCell>
              <TableCell>{roleLabel(invitation.role)}</TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onRevoke?.(invitation.id)}
                  >
                    Revoke
                    <span className="sr-only">
                      {" "}
                      invitation for {invitation.email}
                    </span>
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog}
    </>
  );
}

/** Loading placeholder shaped like the members table. */
export function MembersTableSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading members"
      className="py-1"
    >
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <SkeletonListRow key={index} />
      ))}
    </div>
  );
}
