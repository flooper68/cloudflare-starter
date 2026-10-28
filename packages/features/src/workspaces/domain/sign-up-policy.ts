import { normalizeEmail } from "./invitation";
import { modeAllows, type WorkspaceMode } from "./mode";

/** SIGN_UP: anyone may create an account, or only people let in by a rule below. */
export const SIGN_UP_POLICIES = ["open", "invite"] as const;
export type SignUpPolicy = (typeof SIGN_UP_POLICIES)[number];

export interface SignUpRequest {
  readonly mode: WorkspaceMode;
  readonly policy: SignUpPolicy;
  /** SIGN_UP_DOMAINS: email domains that may sign up without an invitation. */
  readonly allowedDomains: readonly string[];
  /** BOOTSTRAP_ADMIN_EMAIL: a standing invitation that always works. */
  readonly bootstrapAdminEmail: string | null;
  readonly email: string;
  /** Whether a pending, unexpired invitation exists for this email. */
  readonly hasPendingInvitation: boolean;
}

export type SignUpDecision =
  | {
      readonly allowed: true;
      readonly reason: "bootstrap" | "open" | "domain" | "invitation";
    }
  | { readonly allowed: false };

/** The domain part of an email, lower-cased. */
function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/**
 * Whether a new account may be created for `email`. The bootstrap admin always may; with
 * SIGN_UP=open anyone may; with SIGN_UP=invite an allowed domain or a pending invitation
 * (in modes that have invitations) lets the person in.
 */
export function decideSignUp(request: SignUpRequest): SignUpDecision {
  const email = normalizeEmail(request.email);
  if (request.bootstrapAdminEmail && email === request.bootstrapAdminEmail) {
    return { allowed: true, reason: "bootstrap" };
  }
  if (request.policy === "open") return { allowed: true, reason: "open" };
  if (request.allowedDomains.includes(domainOf(email))) {
    return { allowed: true, reason: "domain" };
  }
  if (request.hasPendingInvitation && modeAllows(request.mode, "members")) {
    return { allowed: true, reason: "invitation" };
  }
  return { allowed: false };
}
