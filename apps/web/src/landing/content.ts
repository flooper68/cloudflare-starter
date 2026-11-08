/**
 * The copy and links of the landing page (src/pages/index.astro): the starter's own
 * page. A project replaces this file (and the page's sections) with its product's
 * landing; docs/guides/how-to-publish-docs-and-landing.md#replace-the-landing-page.
 * Feature highlights summarise the README's Highlights.
 */
import { DOCS } from "@/docs/docs.config";

export const LINKS = {
  docs: "/docs/",
  start: "/docs/start/",
  github: DOCS.repoUrl,
  storybook: "/_storybook/",
  signIn: "/sign-in",
  /** Signed out, /app redirects to /sign-in; signed in, it opens the dashboard. */
  app: "/app/dashboard",
} as const;

export const HERO = {
  badges: ["Template", "Bun monorepo"],
  title: "The Cloudflare-first SaaS starter",
  description:
    "One Astro Worker for the site, the app, the API, queues and cron. Auth, workspaces, billing, admin, notifications and an MCP server, already built, tested and documented. Clone it, choose your modes, strip what you don't need.",
  commands: [
    `git clone ${DOCS.repoUrl} my-product`,
    "cd my-product && bun install",
    "bun run setup:auth   # workspace mode, sign-up, billing",
    "bun run dev:web",
  ],
} as const;

export type FeatureIcon =
  | "shield"
  | "users"
  | "card"
  | "admin"
  | "bot"
  | "bell"
  | "files"
  | "clock"
  | "activity"
  | "scroll"
  | "flag"
  | "palette";

export const FEATURES: readonly {
  readonly icon: FeatureIcon;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    icon: "shield",
    title: "Auth and account security",
    description:
      "Better Auth with email and password and/or Google, passkeys, authenticator two-factor with recovery codes, email verification, and MCP access bound to the session that granted it.",
  },
  {
    icon: "users",
    title: "Workspaces and roles",
    description:
      "Personal, single or multi-workspace mode; open or invite-only sign-up; invitations by email; one permission map; a members page and a switcher.",
  },
  {
    icon: "card",
    title: "Plans and limits",
    description:
      "A plan catalog in code, trials with a daily expiry, usage meters, limit-reached errors with upgrade options, BILLING off, manual or through a provider.",
  },
  {
    icon: "admin",
    title: "Admin portal",
    description:
      "Users, impersonation, workspace rescue, audit log, data requests and a D1 overview; destructive actions behind a recent sign-in.",
  },
  {
    icon: "bot",
    title: "MCP server with OAuth",
    description:
      "Claude signs in as the user at /mcp. A test fails the build if any API lacks an MCP tool or a reasoned exemption.",
  },
  {
    icon: "bell",
    title: "Notifications",
    description:
      "A typed catalog, an in-app inbox with an unread badge, email at once or as a daily digest, preferences per type and one-click unsubscribe.",
  },
  {
    icon: "files",
    title: "Files on R2, with a trash",
    description:
      "Uploads through the Worker or straight to R2 with presigned URLs; deleted files restore for 30 days before a daily purge.",
  },
  {
    icon: "clock",
    title: "Jobs and cron",
    description:
      "Typed Queues jobs as CloudEvents with backoff, idempotency keys and a dead-letter queue; a cron catalog checked against wrangler.jsonc.",
  },
  {
    icon: "activity",
    title: "Observability",
    description:
      "OpenTelemetry-shaped logs, metrics and traces on one trace id; error reports give users a reference instead of a stack trace.",
  },
  {
    icon: "scroll",
    title: "Audit log and privacy",
    description:
      "Append-only audit events with the trace id; data exports and account erasure through one pipeline.",
  },
  {
    icon: "flag",
    title: "Flags and analytics",
    description:
      "OpenFeature-shaped flags with workspace, plan and percentage rules; Segment-shaped product events under pseudonymous ids.",
  },
  {
    icon: "palette",
    title: "Component library",
    description:
      "60+ components in Linear's visual language, every story an axe-checked test, re-branded in two files.",
  },
];

export const BUILT_ON = [
  "Astro 7",
  "React 19",
  "Cloudflare Workers",
  "D1 + Drizzle",
  "R2",
  "Queues",
  "Cron Triggers",
  "Email Service",
  "Turnstile",
  "Rate Limiting",
  "Analytics Engine",
  "tRPC",
  "Better Auth",
  "Bun",
] as const;

export const STEPS = [
  {
    title: "Update and pin every dependency",
    description:
      "The pins are only as fresh as the starter's last change. bunfig.toml keeps new ones exact.",
  },
  {
    title: "Choose how users are grouped",
    description:
      "WORKSPACE_MODE, SIGN_UP and BILLING per environment; a deploy refuses to start until you have chosen.",
  },
  {
    title: "Strip what the product does not use",
    description:
      "Containers, Storybook, jobs, cron, files, email, notifications: each has a removal list.",
  },
] as const;
