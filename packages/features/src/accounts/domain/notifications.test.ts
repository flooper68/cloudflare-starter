import { describe, expect, it } from "vitest";

import {
  newSignInNotification,
  passwordChangedNotification,
} from "./notifications";

const context = { appUrl: "https://app.example.test" };

describe("account security notifications", () => {
  it("are security-critical, in-app and email by default", () => {
    for (const definition of [
      passwordChangedNotification,
      newSignInNotification,
    ]) {
      expect(definition.securityCritical).toBe(true);
      expect(definition.defaultChannels).toEqual({ inApp: true, email: true });
    }
  });

  it("password-changed says how and links to a reset", () => {
    const rendered = passwordChangedNotification.render(
      { method: "reset", changedAt: "2026-10-28T09:12:00.000Z" },
      context
    );
    expect(rendered.inApp.body).toContain(
      "through a password reset link at 2026-10-28 09:12 UTC"
    );
    expect(rendered.email.text).toContain(
      "https://app.example.test/forgot-password"
    );
  });

  it("new-sign-in names the browser and IP, escaped in HTML", () => {
    const rendered = newSignInNotification.render(
      {
        userAgent: "<b>Firefox</b>",
        ip: "203.0.113.7",
        signedInAt: "2026-10-28T09:12:00.000Z",
      },
      context
    );
    expect(rendered.inApp.body).toContain(
      "New sign-in from <b>Firefox</b> (IP 203.0.113.7)"
    );
    expect(rendered.email.html).toContain("&lt;b&gt;Firefox&lt;/b&gt;");
    expect(
      newSignInNotification.render(
        { userAgent: null, ip: null, signedInAt: "2026-10-28T09:12:00.000Z" },
        context
      ).inApp.body
    ).toContain("an unknown browser");
  });
});
