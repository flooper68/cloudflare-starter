/** How long an invitation link works. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

/** Emails are compared trimmed and lower-cased everywhere (invitations, sign-up checks). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** When an invitation created at `createdAt` stops working. */
export function invitationExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITATION_TTL_MS);
}

/** The state of an invitation at `now`; accepted and revoked win over expiry. */
export function invitationStatus(
  invitation: {
    readonly acceptedAt: Date | null;
    readonly revokedAt: Date | null;
    readonly expiresAt: Date;
  },
  now: Date
): InvitationStatus {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.revokedAt) return "revoked";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}
