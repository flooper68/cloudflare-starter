import { z } from "zod";

/** A workspace name as people type it: trimmed, 1 to 80 characters. */
export const workspaceNameSchema = z.string().trim().min(1).max(80);

/** The name of each user's personal workspace. */
export const PERSONAL_WORKSPACE_NAME = "Personal";

/**
 * The id of a user's personal workspace: derived from the user, so creating it is
 * insert-or-ignore and provisioning twice (sign-up, then self-heal) makes one workspace.
 */
export function personalWorkspaceId(userId: string): string {
  return `personal-${userId}`;
}
