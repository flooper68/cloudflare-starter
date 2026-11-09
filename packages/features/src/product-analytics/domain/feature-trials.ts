import { z } from "zod";

import { defineEvent } from "../../kernel";

/**
 * The user-facing features a person can try, for the funnel's "first try" and "depth"
 * steps: the parts of the app a signed-in person uses themselves (the groups agents,
 * workspaces, accounts and security, privacy and app platform of
 * apps/web/src/content/features.ts), not the platform underneath. Each is reported once
 * per person, the first time they use it (`app.feature_tried`). A project adds its own
 * features here and a trigger below.
 */
export const TRIED_FEATURES = [
  "notes",
  "files",
  "workspaces",
  "invitations",
  "agents",
  "command_palette",
  "notifications",
  "jobs",
  "email",
  "data_export",
  "trash",
  "passkeys",
  "two_factor",
  "container_run",
] as const;

export type TriedFeature = (typeof TRIED_FEATURES)[number];

/** How the admin portal names each feature. */
export const TRIED_FEATURE_LABELS: Readonly<Record<TriedFeature, string>> = {
  notes: "Notes",
  files: "Files",
  workspaces: "Workspaces",
  invitations: "Invitations",
  agents: "Agent (MCP) connected",
  command_palette: "Command palette",
  notifications: "Notification settings",
  jobs: "Background jobs demo",
  email: "Email demo",
  data_export: "Data export",
  trash: "Trash restore",
  passkeys: "Passkeys",
  two_factor: "Two-factor",
  container_run: "Container workflow",
};

/**
 * What counts as trying a feature: a successful tRPC mutation (from the app or an MCP
 * tool), by procedure path. test/architecture/product-analytics.test.ts checks that each
 * path is a mutation of the router.
 */
export const FEATURE_TRIAL_PROCEDURES: Readonly<Record<string, TriedFeature>> =
  {
    "notes.create": "notes",
    "storage.createUpload": "files",
    "workspace.create": "workspaces",
    "workspace.invitations.create": "invitations",
    "notifications.preferences.update": "notifications",
    "queue.enqueueHello": "jobs",
    "email.sendTest": "email",
    "privacy.requestExport": "data_export",
    "trash.restore": "trash",
    "containerRuns.start": "container_run",
  };

/** Client events of the SPA that count as trying a feature (`analytics.track`). */
export const FEATURE_TRIAL_CLIENT_EVENTS: Readonly<
  Record<string, TriedFeature>
> = {
  "app.command_palette_opened": "command_palette",
};

/**
 * Better Auth endpoints that count as trying a feature when they succeed (the auth
 * after-hook, apps/web/src/server/auth-audit.ts): a passkey added, two-factor turned on,
 * an agent authorized on the consent page.
 */
export const FEATURE_TRIAL_AUTH_PATHS: Readonly<Record<string, TriedFeature>> =
  {
    "/passkey/verify-registration": "passkeys",
    "/two-factor/enable": "two_factor",
    "/oauth2/consent": "agents",
  };

/**
 * A person used a feature for the first time (once per person and feature, kept in the
 * `analytics_milestones` table). The funnel's first-try and depth steps count these.
 */
export const featureTriedEvent = defineEvent(
  "app.feature_tried",
  { strings: ["feature"], numbers: [] },
  z.object({ feature: z.enum(TRIED_FEATURES) }).strict(),
  {
    client: false,
    description:
      "A person used a feature for the first time (once per person and feature)",
  }
);

/**
 * A person came back on a later UTC day than the one they signed up on (once per person):
 * `days_since_sign_up`, whole days. The funnel's return step counts the ones within 7 days.
 */
export const sessionReturnedEvent = defineEvent(
  "app.session_returned",
  { strings: [], numbers: ["days_since_sign_up"] },
  z.object({ days_since_sign_up: z.number().int().min(1) }).strict(),
  {
    client: false,
    description:
      "A person opened the app on a later day than their sign-up (once per person; whole days since)",
  }
);
