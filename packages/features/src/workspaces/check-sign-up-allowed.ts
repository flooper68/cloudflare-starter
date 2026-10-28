import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingGate, Clock } from "../kernel";
import {
  decideSignUp,
  normalizeEmail,
  SINGLE_WORKSPACE_ID,
  type SignUpDecision,
  SignUpNotAllowedError,
  type WorkspaceSettings,
} from "./domain";
import { workspaceInvitations } from "./workspaces.schema";

/**
 * Whether an account may be created for `email` under the environment's settings
 * (sign-up-policy.ts). Called from Better Auth's `user.create.before` hook, so it covers
 * every sign-up method, Google included. Throws SignUpNotAllowedError when refused.
 *
 * In single mode, a sign-up that joins the app's workspace on its own (open sign-up or an
 * allowed domain) takes a seat: it throws LimitReachedError (`limit_reached`) when the
 * workspace's `seats` limit is reached. The bootstrap admin is never refused, and someone
 * with a pending invitation already holds a seat (pending invitations count as seats).
 */
export async function checkSignUpAllowed(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly billing: BillingGate;
  },
  input: { readonly email: string; readonly settings: WorkspaceSettings }
): Promise<Extract<SignUpDecision, { allowed: true }>> {
  const email = normalizeEmail(input.email);
  const single = input.settings.mode === "single";
  const pending =
    input.settings.signUp === "invite" || single
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
  if (single && decision.reason !== "bootstrap" && pending.length === 0) {
    await deps.billing.requireLimit(SINGLE_WORKSPACE_ID, "seats", 1);
  }
  return decision;
}
