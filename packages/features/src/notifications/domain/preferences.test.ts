import { describe, expect, it } from "vitest";

import { createNotificationCatalog } from "./catalog";
import {
  initialEmailState,
  isLocked,
  preferenceMatrix,
  resolveChannels,
  storedOverride,
} from "./preferences";

const memberJoined = {
  type: "workspaces.member-joined",
  defaultChannels: { inApp: true, email: true },
  securityCritical: false,
} as const;
const roleChanged = {
  type: "workspaces.role-changed",
  defaultChannels: { inApp: true, email: false },
  securityCritical: false,
} as const;
const newSignIn = {
  type: "auth.new-sign-in",
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
} as const;

describe("resolveChannels", () => {
  it("uses the type's defaults without overrides", () => {
    expect(resolveChannels(roleChanged, [])).toEqual({
      inApp: true,
      email: false,
    });
  });

  it("applies the user's overrides for that type only", () => {
    expect(
      resolveChannels(memberJoined, [
        { type: "workspaces.member-joined", channel: "email", enabled: false },
        { type: "workspaces.role-changed", channel: "inApp", enabled: false },
      ])
    ).toEqual({ inApp: true, email: false });
  });

  it("ignores overrides of a security type: email always on", () => {
    expect(
      resolveChannels(newSignIn, [
        { type: "auth.new-sign-in", channel: "email", enabled: false },
      ])
    ).toEqual({ inApp: true, email: true });
    expect(isLocked(newSignIn)).toBe(true);
    expect(isLocked(memberJoined)).toBe(false);
  });
});

describe("initialEmailState", () => {
  const on = { inApp: true, email: true };
  it("is none when the email channel is off", () => {
    expect(
      initialEmailState(
        memberJoined,
        { inApp: true, email: false },
        { cadence: "instant", emailEnabled: true }
      )
    ).toBe("none");
  });

  it("is skipped when the deployment has no email", () => {
    expect(
      initialEmailState(memberJoined, on, {
        cadence: "instant",
        emailEnabled: false,
      })
    ).toBe("skipped");
  });

  it("waits for the digest on the daily cadence", () => {
    expect(
      initialEmailState(memberJoined, on, {
        cadence: "daily",
        emailEnabled: true,
      })
    ).toBe("pending_digest");
    expect(
      initialEmailState(memberJoined, on, {
        cadence: "instant",
        emailEnabled: true,
      })
    ).toBe("pending");
  });

  it("never digests a security notification", () => {
    expect(
      initialEmailState(newSignIn, on, { cadence: "daily", emailEnabled: true })
    ).toBe("pending");
  });
});

describe("storedOverride", () => {
  it("stores only differences from the default", () => {
    expect(storedOverride(memberJoined, "email", true)).toBe("delete");
    expect(storedOverride(memberJoined, "email", false)).toBe("upsert");
    expect(storedOverride(roleChanged, "email", true)).toBe("upsert");
  });
});

describe("preferenceMatrix", () => {
  it("lists every type with its resolved channels and lock", () => {
    const render = () => ({
      inApp: { title: "", body: "", href: null },
      email: { subject: "", text: "", html: "" },
    });
    const data = {
      safeParse: (input: unknown) => ({ success: true as const, data: input }),
    };
    const catalog = createNotificationCatalog([
      { ...memberJoined, label: "Someone joins", data, render },
      { ...newSignIn, label: "New sign-in", data, render },
    ]);
    expect(
      preferenceMatrix(catalog, [
        { type: "workspaces.member-joined", channel: "inApp", enabled: false },
      ])
    ).toEqual([
      {
        type: "workspaces.member-joined",
        label: "Someone joins",
        locked: false,
        inApp: false,
        email: true,
      },
      {
        type: "auth.new-sign-in",
        label: "New sign-in",
        locked: true,
        inApp: true,
        email: true,
      },
    ]);
  });
});
