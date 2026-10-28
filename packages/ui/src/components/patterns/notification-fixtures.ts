// Story data for the notification patterns: realistic entries at fixed times.
import type { NotificationItem } from "./notification-list";
import type { NotificationPreferencesData } from "./notification-preferences";

/** "Now" of every notification story, so relative times are stable. */
export const NOW = new Date("2026-10-28T12:00:00.000Z");

export const notificationItems: NotificationItem[] = [
  {
    id: "n-1",
    title: "Grace Hopper joined Analytical Engines",
    body: "Grace Hopper accepted your invitation and joined as Member.",
    href: "/app/members",
    createdAt: "2026-10-28T11:56:00.000Z",
    read: false,
  },
  {
    id: "n-2",
    title: "New sign-in to your account",
    body: "New sign-in from Firefox on macOS (IP 203.0.113.7) at 2026-10-28 09:12 UTC. If this was not you, change your password.",
    href: "/app/profile",
    createdAt: "2026-10-28T09:12:00.000Z",
    read: false,
  },
  {
    id: "n-3",
    title: "You are now Owner in Difference Engine",
    body: "Your role in Difference Engine changed from Member to Owner.",
    href: "/app/members",
    createdAt: "2026-10-26T15:30:00.000Z",
    read: true,
  },
  {
    id: "n-4",
    title: "Your password was changed",
    body: "Your password was changed in your profile at 2026-10-12 08:01 UTC. If this was not you, reset your password now.",
    href: null,
    createdAt: "2026-10-12T08:01:00.000Z",
    read: true,
  },
];

export const preferencesData: NotificationPreferencesData = {
  emailCadence: "instant",
  emailAvailable: true,
  types: [
    {
      type: "workspaces.member-joined",
      label: "Someone joins a workspace you manage",
      locked: false,
      inApp: true,
      email: true,
    },
    {
      type: "workspaces.role-changed",
      label: "Your role in a workspace changes",
      locked: false,
      inApp: true,
      email: false,
    },
    {
      type: "auth.password-changed",
      label: "Your password changes",
      locked: true,
      inApp: true,
      email: true,
    },
    {
      type: "auth.new-sign-in",
      label: "Someone signs in from a new browser or device",
      locked: true,
      inApp: true,
      email: true,
    },
  ],
};
