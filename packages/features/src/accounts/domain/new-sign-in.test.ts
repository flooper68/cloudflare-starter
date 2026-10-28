import { describe, expect, it } from "vitest";

import { isNewSignIn } from "./new-sign-in";

const now = new Date("2026-10-28T12:00:00.000Z");
const accountCreatedAt = new Date("2026-10-01T12:00:00.000Z");
const firefox = "Mozilla/5.0 (Macintosh) Firefox/140.0";
const live = new Date("2026-11-04T12:00:00.000Z");
const expired = new Date("2026-10-27T12:00:00.000Z");

describe("isNewSignIn", () => {
  it("is new with no other session", () => {
    expect(
      isNewSignIn({
        userAgent: firefox,
        otherSessions: [],
        accountCreatedAt,
        now,
      })
    ).toBe(true);
  });

  it("is not new with a live session of the same user agent", () => {
    expect(
      isNewSignIn({
        userAgent: firefox,
        otherSessions: [{ userAgent: firefox, expiresAt: live }],
        accountCreatedAt,
        now,
      })
    ).toBe(false);
  });

  it("is new when the same browser's sessions expired or differ", () => {
    expect(
      isNewSignIn({
        userAgent: firefox,
        otherSessions: [
          { userAgent: firefox, expiresAt: expired },
          { userAgent: "curl/8.0", expiresAt: live },
        ],
        accountCreatedAt,
        now,
      })
    ).toBe(true);
  });

  it("is not new in the account's first minute (a social sign-up)", () => {
    expect(
      isNewSignIn({
        userAgent: firefox,
        otherSessions: [],
        accountCreatedAt: new Date("2026-10-28T11:59:30.000Z"),
        now,
      })
    ).toBe(false);
  });

  it("is new without a user agent", () => {
    expect(
      isNewSignIn({
        userAgent: null,
        otherSessions: [{ userAgent: null, expiresAt: live }],
        accountCreatedAt,
        now,
      })
    ).toBe(true);
  });
});
