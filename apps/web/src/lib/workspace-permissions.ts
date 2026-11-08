/**
 * What the browser needs of the permission map
 * (packages/features/src/workspaces/domain/permissions.ts): the roles allowed to perform
 * the actions the app shell shows or hides an entry for. A copy, so the browser bundle
 * does not pull in the server package; workspace-permissions.test.ts fails when it drifts.
 * Hiding an entry is only a convenience: the server checks every action again.
 */
export const CLIENT_ACTIONS = {
  "notes.read": ["owner", "member"],
  "notes.write": ["owner", "member"],
  "workspace.manage": ["owner"],
  "invitations.manage": ["owner"],
} as const satisfies Record<string, readonly string[]>;

export type ClientAction = keyof typeof CLIENT_ACTIONS;

/** Whether a member with `role` may perform `action`; no role (no workspace) may do nothing. */
export function clientCan(
  role: string | undefined,
  action: ClientAction
): boolean {
  return role !== undefined
    ? (CLIENT_ACTIONS[action] as readonly string[]).includes(role)
    : false;
}
