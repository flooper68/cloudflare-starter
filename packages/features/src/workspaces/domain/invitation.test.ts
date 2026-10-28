import { describe, expect, it } from "vitest";

import {
  INVITATION_TTL_MS,
  invitationExpiresAt,
  invitationStatus,
  normalizeEmail,
} from "./invitation";

const created = new Date("2026-10-28T12:00:00.000Z");
const expiresAt = invitationExpiresAt(created);
const open = { acceptedAt: null, revokedAt: null, expiresAt };

describe("invitations", () => {
  it("expire seven days after they are created", () => {
    expect(INVITATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(expiresAt.toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("are pending until the expiry instant, then expired", () => {
    expect(invitationStatus(open, created)).toBe("pending");
    expect(invitationStatus(open, new Date(expiresAt.getTime() - 1))).toBe(
      "pending"
    );
    expect(invitationStatus(open, expiresAt)).toBe("expired");
  });

  it("stay accepted or revoked regardless of expiry", () => {
    const later = new Date("2027-01-01T00:00:00.000Z");
    expect(invitationStatus({ ...open, acceptedAt: created }, later)).toBe(
      "accepted"
    );
    expect(invitationStatus({ ...open, revokedAt: created }, later)).toBe(
      "revoked"
    );
  });

  it("compare emails trimmed and lower-cased", () => {
    expect(normalizeEmail("  Ada.Lovelace@Example.TEST ")).toBe(
      "ada.lovelace@example.test"
    );
  });
});
