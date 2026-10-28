import { WorkspaceModeError } from "./errors";

/**
 * How the app groups users (WORKSPACE_MODE, set per environment):
 * - personal: every user gets their own workspace at sign-up; nothing is shared.
 * - single: one workspace for the whole app; people join it with roles.
 * - multi: users create, join and switch workspaces; each also gets a personal one.
 */
export const WORKSPACE_MODES = ["personal", "single", "multi"] as const;
export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];

/**
 * The id of the one workspace in single mode. Fixed, so concurrent first sign-ups create
 * it once (insert-or-ignore) instead of racing to create two.
 */
export const SINGLE_WORKSPACE_ID = "single-workspace";

/** What a mode offers. */
export type ModeCapability =
  | "members"
  | "create"
  | "switch"
  | "personalWorkspace";

const CAPABILITIES: Record<WorkspaceMode, readonly ModeCapability[]> = {
  personal: ["personalWorkspace"],
  single: ["members"],
  multi: ["members", "create", "switch", "personalWorkspace"],
};

/** Whether `mode` offers `capability` (members covers invitations and roles too). */
export function modeAllows(
  mode: WorkspaceMode,
  capability: ModeCapability
): boolean {
  return CAPABILITIES[mode].includes(capability);
}

/** Throws WorkspaceModeError when `mode` does not offer `capability`. */
export function requireMode(
  mode: WorkspaceMode,
  capability: ModeCapability,
  operation: string
): void {
  if (!modeAllows(mode, capability))
    throw new WorkspaceModeError(mode, operation);
}
