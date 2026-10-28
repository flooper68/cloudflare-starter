import { describe, expect, it } from "vitest";

import {
  type AdminTarget,
  banExpiry,
  isBanActive,
  isRecentSignIn,
  RECENT_SIGN_IN_MS,
  requireAnotherAdminRemains,
  requireImpersonable,
  requireNotSelf,
} from "./admin-policy";
import {
  CannotImpersonateError,
  InvalidBanExpiryError,
  LastAdminError,
  SelfActionError,
} from "./errors";

const now = new Date("2026-10-28T12:00:00.000Z");
const later = new Date("2026-11-28T12:00:00.000Z");
const earlier = new Date("2026-09-28T12:00:00.000Z");

function target(overrides: Partial<AdminTarget> = {}): AdminTarget {
  return {
    id: "u-grace",
    role: "user",
    banned: false,
    banExpires: null,
    ...overrides,
  };
}

describe("admin policy", () => {
  it("refuses acting on yourself", () => {
    expect(() => requireNotSelf("u-ada", "u-ada", "suspend")).toThrow(
      new SelfActionError("suspend")
    );
    expect(() => requireNotSelf("u-ada", "u-grace", "suspend")).not.toThrow();
  });

  it.each([
    { role: "admin", banned: false, activeAdmins: 1, refused: true },
    { role: "user,admin", banned: false, activeAdmins: 1, refused: true },
    { role: "admin", banned: false, activeAdmins: 0, refused: true },
    { role: "admin", banned: false, activeAdmins: 2, refused: false },
    // A suspended admin is not active: acting on them leaves the count as it is.
    { role: "admin", banned: true, activeAdmins: 1, refused: false },
    { role: "user", banned: false, activeAdmins: 1, refused: false },
    { role: null, banned: false, activeAdmins: 0, refused: false },
  ])(
    "last admin: role $role (suspended $banned) with $activeAdmins active admins → refused $refused",
    ({ role, banned, activeAdmins, refused }) => {
      const check = () =>
        requireAnotherAdminRemains(target({ role, banned }), activeAdmins, now);
      if (refused) expect(check).toThrow(LastAdminError);
      else expect(check).not.toThrow();
    }
  );

  it.each([
    { label: "a regular user", overrides: {}, error: null },
    {
      label: "an admin",
      overrides: { role: "admin" },
      error: new CannotImpersonateError("admin"),
    },
    {
      label: "a permanently suspended user",
      overrides: { banned: true },
      error: new CannotImpersonateError("banned"),
    },
    {
      label: "a user suspended until later",
      overrides: { banned: true, banExpires: later },
      error: new CannotImpersonateError("banned"),
    },
    {
      label: "a user whose suspension has ended",
      overrides: { banned: true, banExpires: earlier },
      error: null,
    },
  ])("impersonating $label", ({ overrides, error }) => {
    const check = () => requireImpersonable(target(overrides), now);
    if (error) expect(check).toThrow(error);
    else expect(check).not.toThrow();
  });

  it("a suspension is in force until it expires", () => {
    expect(isBanActive({ banned: false, banExpires: null }, now)).toBe(false);
    expect(isBanActive({ banned: true, banExpires: null }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: later }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: earlier }, now)).toBe(false);
  });

  it("a suspension ends in the future or never", () => {
    expect(banExpiry(now, null)).toBeNull();
    expect(banExpiry(now, later)).toEqual(later);
    expect(() => banExpiry(now, earlier)).toThrow(InvalidBanExpiryError);
    expect(() => banExpiry(now, now)).toThrow(InvalidBanExpiryError);
  });

  it("a sign-in is recent for 15 minutes", () => {
    const at = (ms: number) => new Date(now.getTime() - ms);
    expect(isRecentSignIn(at(0), now)).toBe(true);
    expect(isRecentSignIn(at(RECENT_SIGN_IN_MS), now)).toBe(true);
    expect(isRecentSignIn(at(RECENT_SIGN_IN_MS + 1), now)).toBe(false);
    expect(isRecentSignIn(null, now)).toBe(false);
    expect(isRecentSignIn(later, now)).toBe(false);
  });
});
