import type { Role } from "./permissions";

/**
 * Who is acting, and where: the signed-in user, the workspace the request is about and
 * their role in it. Resolved once per request by the adapter (`resolveActor`) and passed
 * to every workspace-scoped use case as its second argument.
 */
export interface Actor {
  readonly userId: string;
  readonly workspaceId: string;
  readonly role: Role;
}
