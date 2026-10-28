import { LastOwnerError } from "./errors";
import { can, type Role } from "./permissions";

export interface MemberRole {
  readonly userId: string;
  readonly role: Role;
}

/** A change to one membership: a new role, or `null` when the member leaves or is removed. */
export interface MembershipChange {
  readonly userId: string;
  readonly nextRole: Role | null;
}

/**
 * Whether the workspace still has someone who can manage its members after `change`.
 * The rule behind "the last owner cannot leave, be removed or be demoted", written
 * against the permission map so it keeps holding when the roles are replaced.
 */
export function keepsAManager(
  members: readonly MemberRole[],
  change: MembershipChange
): boolean {
  return members.some((member) => {
    const role =
      member.userId === change.userId ? change.nextRole : member.role;
    return role !== null && can(role, "members.manage");
  });
}

/** Throws LastOwnerError when `change` would leave nobody able to manage members. */
export function requireManagerRemains(
  members: readonly MemberRole[],
  change: MembershipChange
): void {
  if (!keepsAManager(members, change)) throw new LastOwnerError();
}
