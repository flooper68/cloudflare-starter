import { ActionNotAllowedError } from "./errors";

/**
 * Roles and what each may do in a workspace: the app's permission map.
 *
 * The roles below are PLACEHOLDERS: replace them with your product's roles
 * (docs/guides/how-to-configure-workspaces.md#replace-the-roles). Keep this map the one
 * place that says who may do what; use cases ask `can(actor.role, action)`.
 */

/** Placeholder roles; replace with the product's own. */
export const ROLES = ["owner", "member"] as const;
export type Role = (typeof ROLES)[number];

/** The role a workspace's creator (and the single-mode bootstrap admin) gets. */
export const CREATOR_ROLE: Role = "owner";

/** The role of someone who joins without a stated role (single mode without an invitation). */
export const DEFAULT_MEMBER_ROLE: Role = "member";

/**
 * Every action a use case checks, and the roles allowed to perform it. A new action is
 * added here with a domain test (docs/processes/code-review.md checklist 2).
 */
export const ACTIONS = {
  "files.read": ["owner", "member"],
  "files.write": ["owner", "member"],
  "members.read": ["owner", "member"],
  "members.manage": ["owner"],
  "invitations.read": ["owner"],
  "invitations.manage": ["owner"],
  "ownership.transfer": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof ACTIONS;

/** Whether a member with `role` may perform `action`. */
export function can(role: Role, action: Action): boolean {
  return (ACTIONS[action] as readonly Role[]).includes(role);
}

/** The roles allowed to perform `action`. */
export function rolesAllowedTo(action: Action): readonly Role[] {
  return ACTIONS[action];
}

/** Narrows a stored or submitted string to a known role. */
export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Throws ActionNotAllowedError unless `actor.role` may perform `action`. */
export function requirePermission(
  actor: { readonly role: Role },
  action: Action
): void {
  if (!can(actor.role, action)) throw new ActionNotAllowedError(action);
}
