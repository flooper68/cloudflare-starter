import { z } from "zod";

import { defineNotification, html } from "../../kernel";

const PROFILE = "/app/profile";

/** Security notice: the password was changed (signed in, or through a reset link). */
export const passwordChangedNotification = defineNotification({
  type: "auth.password-changed",
  label: "Your password changes",
  data: z
    .object({
      method: z.enum(["change", "reset"]),
      changedAt: z.iso.datetime(),
    })
    .strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
  render: (data, { appUrl }) => {
    const how =
      data.method === "reset"
        ? "through a password reset link"
        : "in your profile";
    const body = `Your password was changed ${how} at ${data.changedAt.replace("T", " ").slice(0, 16)} UTC. If this was not you, reset your password now.`;
    return {
      inApp: { title: "Your password was changed", body, href: PROFILE },
      email: {
        subject: "Your password was changed",
        text: `${body}\n\nReset it: ${appUrl}/forgot-password`,
        html: html`<p>${body}</p><p><a href="${appUrl}/forgot-password">Reset your password</a></p>`
          .value,
      },
    };
  },
});

/** Security notice: a sign-in from a browser or device with no other live session. */
export const newSignInNotification = defineNotification({
  type: "auth.new-sign-in",
  label: "Someone signs in from a new browser or device",
  data: z
    .object({
      userAgent: z.string().max(300).nullable(),
      ip: z.string().max(64).nullable(),
      signedInAt: z.iso.datetime(),
    })
    .strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
  render: (data, { appUrl }) => {
    const from = [
      data.userAgent ?? "an unknown browser",
      data.ip ? `(IP ${data.ip})` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const body = `New sign-in from ${from} at ${data.signedInAt.replace("T", " ").slice(0, 16)} UTC. If this was not you, change your password.`;
    return {
      inApp: { title: "New sign-in to your account", body, href: PROFILE },
      email: {
        subject: "New sign-in to your account",
        text: `${body}\n\nChange your password: ${appUrl}${PROFILE}`,
        html: html`<p>${body}</p><p><a href="${appUrl}${PROFILE}">Change your password</a></p>`
          .value,
      },
    };
  },
});

/** Factors are security-critical changes; no secrets appear in the notice. */
export const securityFactorChangedNotification = defineNotification({
  type: "auth.factor-changed",
  label: "Your sign-in security changes",
  data: z.object({ change: z.string().min(1).max(100) }).strict(),
  defaultChannels: { inApp: true, email: true },
  securityCritical: true,
  render: (data, { appUrl }) => ({
    inApp: {
      title: "Your account security changed",
      body: `Sign-in security was ${data.change}. If this was not you, contact an administrator.`,
      href: "/app/settings/security",
    },
    email: {
      subject: "Your account security changed",
      text: `Sign-in security was ${data.change}. Review ${appUrl}/app/settings/security. If this was not you, contact an administrator.`,
      html: html`<p>Sign-in security was ${data.change}.</p><p><a href="${appUrl}/app/settings/security">Review account security</a>. If this was not you, contact an administrator.</p>`
        .value,
    },
  }),
});
