/**
 * The copy and links of the home page (src/pages/index.astro): the starter's own page.
 * What the starter does (pillars, groups, features) is data in src/content/features.ts;
 * this file holds the page's own words. A project replaces both with its product's
 * landing: docs/guides/how-to-publish-docs-and-landing.md#replace-the-landing-page.
 */
import { DOCS } from "@/docs/docs.config";

export const LINKS = {
  docs: "/docs/",
  start: "/docs/start/",
  changelog: "/docs/changelog/",
  feed: "/docs/changelog.xml",
  github: DOCS.repoUrl,
  issues: `${DOCS.repoUrl}/issues`,
  storybook: "/_storybook/",
  signIn: "/sign-in",
  /**
   * "Try the demo app": sign up on this deployment. A signed-in visitor who follows it is
   * sent on to the app by /sign-up itself, so the prerendered page needs no session.
   */
  demo: "/sign-up",
  /** Per-request pages show it instead of Sign in and Try the demo when signed in. */
  app: "/app/dashboard",
  costs: "https://developers.cloudflare.com/workers/platform/pricing/",
} as const;

/**
 * The hook. Measured on 8 Nov 2026 from a fresh clone to the local sign-up page: about
 * 45 s with Bun's cache warm (clone 27 s, install 3 s, migrate 3 s, dev server and first
 * page 8 s) and about 80 s cold (install 41 s). A deploy needs a Cloudflare login,
 * resources and secrets and was not timed, so the headline says "today", not minutes.
 */
export const HERO = {
  eyebrow: {
    tag: "New",
    text: "Connected agents: see and disconnect every agent",
  },
  title: "Ship an agent-native app today.",
  description:
    "A starter for small, agent-native apps. Sign-in, workspaces, billing and an agent endpoint with access already solved, running on one Cloudflare account for $5 a month plus usage.",
  demoLine: "The demo is this starter, deployed. Already have an account?",
  sceneLabel:
    "One app in the middle, with agents and people sending it requests, and the database, file storage, jobs, email and analytics beside it.",
} as const;

export const SECTIONS = {
  pillars: {
    kicker: "What you get",
    title: "Four things you don't have to build",
    lead: "Start from a working app, not an empty folder. Good for a personal CRM, a team notes tool, or an internal tool your agents act on.",
  },
  map: {
    kicker: "Feature map",
    title: "Everything in the box, and how it connects",
    lead: "Every part of the starter, grouped by what it does for you, and the main ways the parts work together.",
  },
  costs: {
    kicker: "What it costs",
    title: "One platform, one bill.",
    lead: "Everything on this page runs on Cloudflare's Workers Paid plan: $5 a month, plus usage above the included allowances. A small app stays inside them; above them you pay for what you use, for example $0.35 per 1,000 emails after the first 3,000 a month.",
    note: "Prices from Cloudflare's docs, checked 8 Nov 2026. Your domain is extra.",
  },
  start: {
    kicker: "Start in minutes",
    title: "Running locally in under two minutes",
    lead: "The database, files, email, queue and schedules all run locally. Nothing else to install but Bun.",
    agent:
      "AGENTS.md points your coding agent to the docs; its skills set up sign-in, the database and email.",
    measured:
      "Measured from a fresh clone to the sign-up page: about 45 seconds with Bun's cache warm, 80 seconds cold.",
  },
  closing: {
    title: "Start from a working app",
    lead: "Try the demo, then clone the repo. Your agents can use it the day you deploy.",
  },
} as const;

/** The included allowances that matter first, from docs/start costs. */
export const COSTS: readonly {
  readonly what: string;
  readonly included: string;
  readonly after: string;
}[] = [
  { what: "Requests", included: "10 million", after: "$0.30 / million" },
  {
    what: "Database",
    included: "25 billion rows read · 50 million written · 5 GB",
    after: "$1 / million writes",
  },
  {
    what: "File storage",
    included: "10 GB · free egress",
    after: "$0.015 / GB-month",
  },
  {
    what: "Background jobs",
    included: "1 million queue operations (about 330,000 jobs)",
    after: "$0.40 / million",
  },
  { what: "Email", included: "3,000 emails", after: "$0.35 / 1,000" },
  {
    what: "Analytics and metrics",
    included: "10 million data points",
    after: "Not billed yet",
  },
];

/** The receipt beside the cost table: what the $5 covers. */
export const RECEIPT: readonly string[] = [
  "Website, docs and app",
  "Agent endpoint",
  "Database",
  "File storage",
  "Job queue and schedules",
  "Email",
  "Analytics, logs and traces",
  "Rate limits and bot checks",
];

export const STEPS: readonly {
  readonly title: string;
  readonly command: string;
}[] = [
  { title: "Clone it", command: `git clone ${DOCS.repoUrl} my-app` },
  { title: "Install", command: "cd my-app && bun install" },
  {
    title: "Add local settings",
    command:
      "cp apps/web/.dev.vars.example apps/web/.dev.vars && bun run db:migrate:local",
  },
  { title: "Run it", command: "bun run dev:web" },
];

export const PRODUCTION_CHECKS: readonly string[] = [
  "Tested at every layer, in CI",
  "Accessible components, checked on every story",
  "Strict content policy, checked in every journey",
  "Logs, metrics and traces in OpenTelemetry shape",
  "Every change to data is audited",
  "Every table is in the privacy catalog",
  "Every action has a rate limit",
  "Health checks in the IETF format",
];

/** The only place the page names the technology. */
export const UNDER_THE_HOOD =
  "Astro and React on Cloudflare Workers, D1 with Drizzle, R2, Queues, Cron Triggers, Email Service, Analytics Engine, Turnstile, Rate Limiting, Better Auth and tRPC, on Bun.";

export const FOOTER: readonly {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}[] = [
  {
    title: "Product",
    links: [
      { label: "Try the demo", href: LINKS.demo },
      { label: "Sign in", href: LINKS.signIn },
      { label: "Changelog", href: LINKS.changelog },
      { label: "Feature map", href: "/#feature-map" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "Overview", href: LINKS.docs },
      { label: "Start a project", href: LINKS.start },
      { label: "Add a feature", href: "/docs/guides/how-to-add-a-feature/" },
      { label: "Architecture", href: "/docs/architecture/overview/" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: LINKS.github },
      { label: "Storybook", href: LINKS.storybook },
      { label: "Release feed", href: LINKS.feed },
      { label: "Report an issue", href: LINKS.issues },
    ],
  },
];
