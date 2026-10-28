import {
  CannotImpersonateError,
  InvalidBanExpiryError,
  LastAdminError,
  SelfActionError,
} from "./errors";
import { hasAdminRole } from "./platform-role";

/** What the rules need to know about the user an admin acts on. */
export interface AdminTarget {
  readonly id: string;
  readonly role: string | null;
  readonly banned: boolean;
  readonly banExpires: Date | null;
}

/** How long a sign-in counts as recent for destructive admin actions. */
export const RECENT_SIGN_IN_MS = 15 * 60 * 1000;

/**
 * Whether a suspension is in force at `now`. Better Auth lifts an expired one at the next
 * sign-in; until then the row still says banned, so expiry is checked here.
 */
export function isBanActive(
  target: Pick<AdminTarget, "banned" | "banExpires">,
  now: Date
): boolean {
  return (
    target.banned &&
    (target.banExpires === null || target.banExpires.getTime() > now.getTime())
  );
}

/** Admins act on other people's accounts, never their own (`operation` names what was tried). */
export function requireNotSelf(
  adminUserId: string,
  targetUserId: string,
  operation: string
): void {
  if (adminUserId === targetUserId) throw new SelfActionError(operation);
}

/**
 * The app keeps at least one active admin: demoting, suspending or deleting the last one
 * is refused. `activeAdmins` counts admins whose suspension is not in force at `now`, the
 * target included. A suspended admin target is not active, so acting on them changes
 * nothing about the count and is allowed. Through the portal the acting admin is active
 * and never the target, so this is the guard against a concurrent change and against
 * scripts or other callers.
 */
export function requireAnotherAdminRemains(
  target: Pick<AdminTarget, "role" | "banned" | "banExpires">,
  activeAdmins: number,
  now: Date
): void {
  if (
    hasAdminRole(target.role) &&
    !isBanActive(target, now) &&
    activeAdmins <= 1
  ) {
    throw new LastAdminError();
  }
}

/** Only regular, active users can be impersonated: never admins, never suspended users. */
export function requireImpersonable(target: AdminTarget, now: Date): void {
  if (hasAdminRole(target.role)) throw new CannotImpersonateError("admin");
  if (isBanActive(target, now)) throw new CannotImpersonateError("banned");
}

/** A suspension is permanent (`null`) or ends after `now`. */
export function banExpiry(now: Date, expiresAt: Date | null): Date | null {
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new InvalidBanExpiryError();
  }
  return expiresAt;
}

/**
 * Whether a sign-in at `signedInAt` is recent enough for a destructive admin action
 * (ban, delete, role change, session revocation). Null means no sign-in is known.
 */
export function isRecentSignIn(signedInAt: Date | null, now: Date): boolean {
  if (!signedInAt) return false;
  const age = now.getTime() - signedInAt.getTime();
  return age >= 0 && age <= RECENT_SIGN_IN_MS;
}
