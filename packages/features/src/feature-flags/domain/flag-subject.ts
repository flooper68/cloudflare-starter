import type { FlagRolloutBy } from "./catalog";

/** Who a flag is evaluated for: built from the request context by the adapter. */
export interface FlagSubject {
  readonly userId: string | null;
  readonly workspaceId: string | null;
  /** The workspace's plan; null until plans exist. */
  readonly plan: string | null;
  /** APP_ENV of the deployment. */
  readonly environment: string;
}

/**
 * The OpenFeature evaluation context for one flag: the targeting key is the workspace or
 * the user id, per the flag's `rolloutBy`, so a workspace rollout gives every member the
 * same value. Null when that id is missing (anonymous, or no workspace yet): percentage
 * rules then do not match and the flag falls through.
 */
export function flagContextFor(
  rolloutBy: FlagRolloutBy,
  subject: FlagSubject
): {
  readonly targetingKey: string | null;
  readonly userId: string | null;
  readonly workspaceId: string | null;
  readonly plan: string | null;
  readonly environment: string;
} {
  return {
    targetingKey:
      rolloutBy === "workspace" ? subject.workspaceId : subject.userId,
    userId: subject.userId,
    workspaceId: subject.workspaceId,
    plan: subject.plan,
    environment: subject.environment,
  };
}
