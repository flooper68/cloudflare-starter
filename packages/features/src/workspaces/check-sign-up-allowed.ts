import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  decideSignUp,
  normalizeEmail,
  type SignUpDecision,
  SignUpNotAllowedError,
  type WorkspaceSettings,
} from "./domain";
import { workspaceInvitations } from "./workspaces.schema";

/**
 * Whether an account may be created for `email` under the environment's settings
 * (sign-up-policy.ts). Called from Better Auth's `user.create.before` hook, so it covers
 * every sign-up method, Google included. Throws SignUpNotAllowedError when refused.
 */
export async function checkSignUpAllowed(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly email: string; readonly settings: WorkspaceSettings }
): Promise<Extract<SignUpDecision, { allowed: true }>> {
  const email = normalizeEmail(input.email);
  const pending =
    input.settings.signUp === "invite"
      ? await deps.db
          .select({ id: workspaceInvitations.id })
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.email, email),
              isNull(workspaceInvitations.acceptedAt),
              isNull(workspaceInvitations.revokedAt),
              gt(workspaceInvitations.expiresAt, deps.clock.now())
            )
          )
          .limit(1)
      : [];

  const decision = decideSignUp({
    mode: input.settings.mode,
    policy: input.settings.signUp,
    allowedDomains: input.settings.signUpDomains,
    bootstrapAdminEmail: input.settings.bootstrapAdminEmail,
    email,
    hasPendingInvitation: pending.length > 0,
  });
  if (!decision.allowed) throw new SignUpNotAllowedError();
  return decision;
}
