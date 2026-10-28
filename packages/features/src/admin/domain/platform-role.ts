/**
 * Platform roles: who may use the admin portal. Separate from workspace roles
 * (workspaces/domain/permissions.ts): a platform admin administers the whole app, a
 * workspace owner one workspace. Stored in Better Auth's `user.role` column, which may hold
 * a comma list (`admin,user`).
 */
export const PLATFORM_ROLES = ["user", "admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ADMIN_ROLE: PlatformRole = "admin";

/** Whether a stored `user.role` value includes the admin role. */
export function hasAdminRole(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .map((value) => value.trim())
    .includes(ADMIN_ROLE);
}

/** The platform role a stored `user.role` value amounts to (unset means user). */
export function platformRoleOf(role: string | null | undefined): PlatformRole {
  return hasAdminRole(role) ? "admin" : "user";
}
