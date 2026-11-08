/**
 * What the starter does, as data: the four pillars, the seven capability groups, every
 * feature, how features work together, and the main flows the feature map draws. The one
 * source of truth for the home page (pillar cards, feature map) and the docs (a features
 * section, "Works with"). Plain data and pure helpers: no Astro, no DOM, so a page, a
 * component, a test or a script can import it.
 *
 * Stable API (docs/guides/how-to-publish-docs-and-landing.md#feature-data):
 * - `PILLARS`, `GROUPS`, `FEATURES`, `EDGES`, `FLOWS`: readonly arrays, in display order.
 * - Types: `Pillar`, `Group`, `Feature`, `FeatureEdge`, `MapFlow`, `PillarId`, `GroupId`,
 *   `FeatureId`, `FeatureStatus`, `MapNodeId`.
 * - Lookups: `pillar(id)`, `group(id)`, `feature(id)`; lists: `groupsOf(pillarId)`,
 *   `featuresOf(groupId)`, `highlightsOf(groupId)`, `worksWith(featureId)`.
 * - `docsHref(slug)`: the site URL of a `docs` slug (`guides/how-to-setup-mcp` →
 *   `/docs/guides/how-to-setup-mcp/`).
 *
 * Ids never change once published (docs pages and links use them); add, don't rename.
 * `docs` slugs are routes under /docs/ without slashes at the ends, and must be published
 * pages: apps/web/src/content/features.test.ts fails otherwise.
 */

export type PillarId = "agents" | "scaffold" | "platform" | "infra";

export type GroupId =
  | "agents-mcp"
  | "developer-experience"
  | "accounts-security"
  | "workspaces-billing-admin"
  | "privacy-data"
  | "app-platform"
  | "observability-ops";

/**
 * `built`: in the starter and used by the app. `demo`: runnable, but only as a developer
 * demo, not used by the product (Containers: the container workflow demo). `planned`:
 * designed, not built yet.
 */
export type FeatureStatus = "built" | "demo" | "planned";

export interface Pillar {
  readonly id: PillarId;
  /** "01" … "04", the order on the page. */
  readonly n: string;
  readonly title: string;
  /** One sentence: what the visitor gets. */
  readonly benefit: string;
  /** Five short points for the pillar card on the home page. */
  readonly points: readonly string[];
}

export interface Group {
  readonly id: GroupId;
  readonly pillar: PillarId;
  readonly title: string;
  /** The map's short label. */
  readonly short: string;
  readonly benefit: string;
  /** The group's main docs page. */
  readonly docs: string;
  /** 3 to 6 feature ids the map's card lists, in order. */
  readonly highlights: readonly FeatureId[];
}

export interface Feature {
  readonly id: FeatureId;
  readonly name: string;
  /** One line: what it does for the builder or their users. */
  readonly benefit: string;
  /** The group's pillar (kept on the feature for consumers that list by pillar). */
  readonly pillar: PillarId;
  readonly group: GroupId;
  readonly docs: string;
  readonly status: FeatureStatus;
}

/** Two features that work together, with the reason in plain words. */
export interface FeatureEdge {
  readonly a: FeatureId;
  readonly b: FeatureId;
  readonly why: string;
}

/** A node of the feature map: the app at the centre, or a capability group. */
export type MapNodeId = "app" | GroupId;

/**
 * One of the map's few edges: a main flow between groups (or the app). `main` marks
 * the path the map's single idle pulse travels.
 */
export interface MapFlow {
  readonly from: MapNodeId;
  readonly to: MapNodeId;
  readonly why: string;
  readonly main?: boolean;
}

export const PILLARS: readonly Pillar[] = [
  {
    id: "agents",
    n: "01",
    title: "Agent-native",
    benefit:
      "Your agents use the app the way your users do, with access already solved.",
    points: [
      "Claude or any MCP client signs in as a user, after a consent page in plain words",
      "Same workspaces and permissions as in the browser",
      "Every API has an agent tool; a test fails the build otherwise",
      "See and disconnect agents in Settings",
      "Built for coding agents too: AGENTS.md, skills, setup scripts",
    ],
  },
  {
    id: "scaffold",
    n: "02",
    title: "Full scaffold, ready",
    benefit:
      "The parts every app needs are built, tested and documented. Keep what you use.",
    points: [
      "Sign-in with passkeys and two-factor",
      "Workspaces, invites and roles",
      "Plans, trials and usage limits",
      "Admin portal, notifications, data export and delete",
      "Notes: a small real feature to copy for yours",
    ],
  },
  {
    id: "platform",
    n: "03",
    title: "Everything a full app needs",
    benefit:
      "Background work, email, files and flags without adding another service.",
    points: [
      "Scheduled tasks and a job queue with retries",
      "Email, simulated locally",
      "File storage with a 30-day trash",
      "Feature flags and a command palette",
      "Containers: a workflow demo you can run in the app",
    ],
  },
  {
    id: "infra",
    n: "04",
    title: "Infra solved",
    benefit:
      "Production-ready from day one, so you don't have to think about it.",
    points: [
      "Product analytics without cookies",
      "Logs, metrics and traces on one reference",
      "Health checks for your uptime monitor",
      "Strict security headers, rate limits, bot checks",
      "Roll the database back to any minute in 30 days",
    ],
  },
];

export const GROUPS: readonly Group[] = [
  {
    id: "agents-mcp",
    pillar: "agents",
    title: "Agents & MCP",
    short: "Agents",
    benefit:
      "Agents sign in as a user, ask first, and act through the same API as the app.",
    docs: "features/agents",
    highlights: [
      "agent-endpoint",
      "agent-consent",
      "connected-agents",
      "tool-parity",
      "untrusted-data",
    ],
  },
  {
    id: "developer-experience",
    pillar: "agents",
    title: "Built for coding agents",
    short: "Coding agents",
    benefit:
      "Your coding agent knows where everything is, and the tests keep it honest.",
    docs: "start",
    highlights: [
      "agents-md",
      "agent-skills",
      "setup-scripts",
      "tests-every-layer",
      "architecture-tests",
    ],
  },
  {
    id: "accounts-security",
    pillar: "scaffold",
    title: "Accounts & security",
    short: "Sign-in & security",
    benefit:
      "Sign-in, passkeys and two-factor, with rate limits and strict headers on every page.",
    docs: "features/accounts",
    highlights: [
      "sign-in-methods",
      "passkeys",
      "two-factor",
      "rate-limits",
      "security-headers",
    ],
  },
  {
    id: "workspaces-billing-admin",
    pillar: "scaffold",
    title: "Workspaces, billing & admin",
    short: "Workspaces & billing",
    benefit:
      "People work in workspaces with roles; plans set the limits; admins can help anyone.",
    docs: "features/workspaces",
    highlights: [
      "workspaces",
      "invitations",
      "roles",
      "plans-limits",
      "admin-portal",
    ],
  },
  {
    id: "privacy-data",
    pillar: "scaffold",
    title: "Privacy & data",
    short: "Privacy & data",
    benefit:
      "Export, erase, restore from trash and audit, built in rather than bolted on.",
    docs: "features/privacy",
    highlights: ["data-export", "account-erasure", "trash", "audit-log"],
  },
  {
    id: "app-platform",
    pillar: "platform",
    title: "App platform",
    short: "Jobs, email & files",
    benefit:
      "Jobs, schedules, email, files, notifications and flags, ready for your features.",
    docs: "features/notes",
    highlights: [
      "background-jobs",
      "scheduled-tasks",
      "email",
      "notifications",
      "file-storage",
      "feature-flags",
    ],
  },
  {
    id: "observability-ops",
    pillar: "infra",
    title: "Observability & ops",
    short: "Observability",
    benefit:
      "Every request and job is logged, measured and traced; health checks answer monitors.",
    docs: "features/observability",
    highlights: [
      "product-analytics",
      "logs-errors",
      "metrics-traces",
      "health-checks",
      "database-restore",
    ],
  },
];

const f = <const Id extends string>(
  id: Id,
  group: GroupId,
  name: string,
  benefit: string,
  docs: string,
  status: FeatureStatus = "built"
) => ({ id, group, name, benefit, docs, status });

const RAW = [
  // Agents & MCP
  f(
    "agent-endpoint",
    "agents-mcp",
    "Agent endpoint",
    "Claude or any MCP client signs in as a user and acts through tools.",
    "features/agents"
  ),
  f(
    "agent-consent",
    "agents-mcp",
    "Agent sign-in and consent",
    "Agents ask first, with the scopes in plain words.",
    "features/agents"
  ),
  f(
    "session-bound-tokens",
    "agents-mcp",
    "Tokens tied to the browser",
    "Signing that browser out ends the agent's access.",
    "features/agents"
  ),
  f(
    "connected-agents",
    "agents-mcp",
    "Connected agents",
    "See every agent you allowed in Settings and disconnect one at once.",
    "features/agents"
  ),
  f(
    "tool-parity",
    "agents-mcp",
    "A tool for every API",
    "A test fails the build if an API has no tool and no reason.",
    "features/agents"
  ),
  f(
    "admin-agent-tools",
    "agents-mcp",
    "Admin tools for agents",
    "Platform admins run the admin portal from an agent, destructive actions behind a fresh sign-in.",
    "features/admin"
  ),
  f(
    "untrusted-data",
    "agents-mcp",
    "Untrusted-data wrapping",
    "User content returned to agents is marked as data, not instructions.",
    "features/agents"
  ),
  // Built for coding agents
  f(
    "agents-md",
    "developer-experience",
    "AGENTS.md and the docs index",
    "Your coding agent knows where everything is.",
    "start"
  ),
  f(
    "agent-skills",
    "developer-experience",
    "Agent skills",
    "Set up sign-in, the database and email by asking.",
    "guides/how-to-setup-auth"
  ),
  f(
    "setup-scripts",
    "developer-experience",
    "Setup scripts and doctor",
    "Resources, secrets, auth, admins, analytics, email and storage, checked.",
    "guides/how-to-setup-web-app"
  ),
  f(
    "tests-every-layer",
    "developer-experience",
    "Tests at every layer",
    "Domain, integration, API, components and browser journeys, all in CI.",
    "architecture/testing"
  ),
  f(
    "architecture-tests",
    "developer-experience",
    "Architecture tests",
    "They keep the structure honest: audit, privacy, trash, rate limits, agent tools.",
    "architecture/testing"
  ),
  f(
    "component-library",
    "developer-experience",
    "Accessible component library",
    "60+ components, every story checked with axe, re-branded in two files.",
    "guides/how-to-use-storybook"
  ),
  f(
    "docs-site",
    "developer-experience",
    "Docs site with search",
    "Your Markdown at /docs, with release notes and a feed.",
    "guides/how-to-publish-docs-and-landing"
  ),
  f(
    "smoke-suite",
    "developer-experience",
    "Smoke suite and QA checklist",
    "Checked after every deploy.",
    "guides/how-to-qa-a-deployment"
  ),
  f(
    "ci",
    "developer-experience",
    "CI, with optional self-hosted runners",
    "Every check runs on every pull request.",
    "guides/how-to-setup-ci"
  ),
  f(
    "pinned-dependencies",
    "developer-experience",
    "Pinned dependencies and a bundle budget",
    "No surprise upgrades or bloat.",
    "processes/dependencies"
  ),
  // Accounts & security
  f(
    "sign-in-methods",
    "accounts-security",
    "Email, password and Google sign-in",
    "Switch each method per environment.",
    "features/accounts"
  ),
  f(
    "email-verification",
    "accounts-security",
    "Email verification and password reset",
    '"Check your inbox", with a rate-limited resend.',
    "features/accounts"
  ),
  f(
    "passkeys",
    "accounts-security",
    "Passkeys",
    "Sign in without a password.",
    "features/accounts"
  ),
  f(
    "two-factor",
    "accounts-security",
    "Two-factor",
    "Authenticator and recovery codes, with a policy per environment.",
    "features/accounts"
  ),
  f(
    "step-up",
    "accounts-security",
    "Fresh second factor for admin actions",
    "A stolen session can't wipe data.",
    "features/accounts"
  ),
  f(
    "account-settings",
    "accounts-security",
    "Account settings",
    "Profile, avatar, email change, linked accounts, sessions, locale and theme.",
    "features/accounts"
  ),
  f(
    "rate-limits",
    "accounts-security",
    "Rate limits on every action",
    "A test fails if a mutation has no policy.",
    "guides/how-to-configure-abuse-protection"
  ),
  f(
    "bot-check",
    "accounts-security",
    "Bot check on sign-up and sign-in",
    "Stops scripted sign-ups.",
    "guides/how-to-configure-abuse-protection"
  ),
  f(
    "security-headers",
    "accounts-security",
    "Strict security headers",
    "A content policy checked in every browser test; violations are reported.",
    "guides/how-to-configure-security-headers"
  ),
  // Workspaces, billing & admin
  f(
    "workspaces",
    "workspaces-billing-admin",
    "Workspaces",
    "Personal, one team or many; data belongs to workspaces.",
    "features/workspaces"
  ),
  f(
    "sign-up-policy",
    "workspaces-billing-admin",
    "Open or invite-only sign-up",
    "With a domain allowlist and a first admin.",
    "features/workspaces"
  ),
  f(
    "invitations",
    "workspaces-billing-admin",
    "Invitations by email",
    "Teammates accept on a page of their own.",
    "features/workspaces"
  ),
  f(
    "roles",
    "workspaces-billing-admin",
    "Roles from one permission map",
    "The same rules in the app, the API and for agents.",
    "features/workspaces"
  ),
  f(
    "members",
    "workspaces-billing-admin",
    "Members page and workspace switcher",
    "Manage people without leaving the app.",
    "features/workspaces"
  ),
  f(
    "workspace-settings",
    "workspaces-billing-admin",
    "Workspace settings",
    "Name, logo and a confirmed deletion.",
    "features/workspaces"
  ),
  f(
    "plans-limits",
    "workspaces-billing-admin",
    "Plans and usage limits",
    "A catalog in code, usage meters and upgrade options when a limit is reached.",
    "features/billing"
  ),
  f(
    "trials",
    "workspaces-billing-admin",
    "Trials",
    "A daily job ends them on time.",
    "features/billing"
  ),
  f(
    "billing-modes",
    "workspaces-billing-admin",
    "Billing off, manual or a provider",
    "Start free, bring your own payment adapter later.",
    "features/billing"
  ),
  f(
    "admin-portal",
    "workspaces-billing-admin",
    "Admin portal",
    "Find users, suspend, sign out, reset, change role, erase.",
    "features/admin"
  ),
  f(
    "impersonation",
    "workspaces-billing-admin",
    "Impersonation",
    "See what a user sees, with a banner and an audit entry.",
    "features/admin"
  ),
  f(
    "workspace-rescue",
    "workspaces-billing-admin",
    "Workspace rescue",
    "Reassign an owner or delete a workspace.",
    "features/admin"
  ),
  // Privacy & data
  f(
    "data-export",
    "privacy-data",
    "Data export",
    "Personal and workspace ZIPs, built in the background, behind expiring links.",
    "features/privacy"
  ),
  f(
    "account-erasure",
    "privacy-data",
    "Account erasure",
    "Self-service or by an admin, through one pipeline.",
    "features/privacy"
  ),
  f(
    "privacy-catalog",
    "privacy-data",
    "Privacy data catalog",
    "Every table declares its data; CI enforces it.",
    "features/privacy"
  ),
  f(
    "trash",
    "privacy-data",
    "Trash",
    "Deleted notes and files restore for 30 days.",
    "features/privacy"
  ),
  f(
    "storage-reconciliation",
    "privacy-data",
    "Storage reconciliation",
    "Report or remove orphaned files.",
    "guides/how-to-use-trash"
  ),
  f(
    "audit-log",
    "privacy-data",
    "Audit log",
    "Append-only, with each request's reference and a retention.",
    "features/privacy"
  ),
  f(
    "security-notices",
    "privacy-data",
    "Security notices",
    "People always hear about new sign-ins and changes.",
    "features/notifications"
  ),
  // App platform
  f(
    "notes-example",
    "app-platform",
    "Notes, the example feature",
    "A small real feature wired end to end. Copy it.",
    "features/notes"
  ),
  f(
    "command-palette",
    "app-platform",
    "Command palette",
    "Jump to any page, note, workspace or action.",
    "features/command-palette"
  ),
  f(
    "notifications",
    "app-platform",
    "Notifications",
    "An inbox, preferences per type, a daily digest and one-click unsubscribe.",
    "features/notifications"
  ),
  f(
    "email",
    "app-platform",
    "Email",
    "Send from the app; simulated locally.",
    "features/jobs-and-email"
  ),
  f(
    "file-storage",
    "app-platform",
    "File storage",
    "Uploads through the app or straight to storage with signed links.",
    "features/files"
  ),
  f(
    "background-jobs",
    "app-platform",
    "Background jobs",
    "Typed, with retries, no duplicates and a dead-letter queue.",
    "features/jobs-and-email"
  ),
  f(
    "scheduled-tasks",
    "app-platform",
    "Scheduled tasks",
    "One catalog, checked against the config.",
    "features/jobs-and-email"
  ),
  f(
    "feature-flags",
    "app-platform",
    "Feature flags",
    "Roll out by workspace, plan or percentage.",
    "guides/how-to-use-feature-flags"
  ),
  f(
    "typed-api",
    "app-platform",
    "Typed API and a REST example",
    "The app and agents share it.",
    "architecture/overview"
  ),
  f(
    "containers",
    "app-platform",
    "Containers",
    "A Workflow runs a Docker container task and keeps each step; a capped demo in the app.",
    "guides/how-to-run-container-workflows",
    "demo"
  ),
  f(
    "container-tasks",
    "app-platform",
    "Container tasks from jobs",
    "Send a bounded task to a container through the queue and keep the result.",
    "guides/how-to-run-container-workflows",
    "planned"
  ),
  // Observability & ops
  f(
    "product-analytics",
    "observability-ops",
    "Product analytics",
    "Events per feature under pseudonymous ids, no personal data.",
    "features/observability"
  ),
  f(
    "web-analytics",
    "observability-ops",
    "Cookieless web analytics",
    "Page views without a cookie banner (optional).",
    "features/observability"
  ),
  f(
    "logs-errors",
    "observability-ops",
    "Logs and error reports",
    "One trace id across requests and jobs; users quote a reference.",
    "features/observability"
  ),
  f(
    "metrics-traces",
    "observability-ops",
    "Metrics and traces",
    "Latency of requests, procedures, jobs and schedules.",
    "features/observability"
  ),
  f(
    "health-checks",
    "observability-ops",
    "Health checks",
    "Point an uptime monitor at /health/ready.",
    "features/observability"
  ),
  f(
    "database-restore",
    "observability-ops",
    "30-day database restore",
    "Roll the database back to any minute in 30 days.",
    "features/observability"
  ),
] as const;

export type FeatureId = (typeof RAW)[number]["id"];

const GROUP_PILLAR = Object.fromEntries(
  GROUPS.map((entry) => [entry.id, entry.pillar])
) as Record<GroupId, PillarId>;

export const FEATURES: readonly Feature[] = RAW.map((entry) => ({
  ...entry,
  id: entry.id as FeatureId,
  pillar: GROUP_PILLAR[entry.group],
}));

export const EDGES: readonly FeatureEdge[] = [
  {
    a: "agent-endpoint",
    b: "agent-consent",
    why: "Agents sign in and ask for consent before any tool call",
  },
  {
    a: "agent-consent",
    b: "sign-in-methods",
    why: "Consent comes after a normal sign-in",
  },
  {
    a: "agent-endpoint",
    b: "roles",
    why: "Tools check the same roles as the app",
  },
  {
    a: "agent-endpoint",
    b: "rate-limits",
    why: "Agent calls are rate limited per user and per address",
  },
  {
    a: "connected-agents",
    b: "session-bound-tokens",
    why: "Disconnecting an agent revokes its tokens",
  },
  {
    a: "tool-parity",
    b: "typed-api",
    why: "Every procedure of the API has a tool",
  },
  {
    a: "scheduled-tasks",
    b: "background-jobs",
    why: "Schedules enqueue jobs",
  },
  {
    a: "notifications",
    b: "email",
    why: "Notifications go out as email at once or as a digest",
  },
  {
    a: "background-jobs",
    b: "email",
    why: "Mail is sent from jobs, with retries",
  },
  {
    a: "data-export",
    b: "background-jobs",
    why: "Exports are built in the background",
  },
  {
    a: "data-export",
    b: "file-storage",
    why: "The ZIP is kept in file storage behind an expiring link",
  },
  {
    a: "trash",
    b: "scheduled-tasks",
    why: "A daily schedule purges what is older than 30 days",
  },
  {
    a: "trash",
    b: "file-storage",
    why: "Deleted files restore from the trash",
  },
  {
    a: "admin-portal",
    b: "audit-log",
    why: "Every admin action is audited",
  },
  {
    a: "audit-log",
    b: "logs-errors",
    why: "Audit events carry the request's trace id",
  },
  {
    a: "trials",
    b: "scheduled-tasks",
    why: "A daily schedule ends trials",
  },
  {
    a: "invitations",
    b: "email",
    why: "Invitations are sent by email",
  },
];

/** The map's edges: few and meaningful, the main flows only. */
export const FLOWS: readonly MapFlow[] = [
  {
    from: "agents-mcp",
    to: "accounts-security",
    why: "An agent signs in as a user and asks for consent",
    main: true,
  },
  {
    from: "accounts-security",
    to: "workspaces-billing-admin",
    why: "Access is checked per workspace and role",
    main: true,
  },
  {
    from: "workspaces-billing-admin",
    to: "app",
    why: "Every request runs in a workspace, within its plan",
    main: true,
  },
  {
    from: "app",
    to: "app-platform",
    why: "Your features run jobs, send email and keep files",
    main: true,
  },
  {
    from: "app-platform",
    to: "privacy-data",
    why: "Exports and erasure run as jobs; files go to the trash first",
  },
  {
    from: "workspaces-billing-admin",
    to: "privacy-data",
    why: "Admin actions are audited; members can export and erase",
  },
  {
    from: "app",
    to: "observability-ops",
    why: "Every request and job is logged, measured and traced",
  },
  {
    from: "accounts-security",
    to: "observability-ops",
    why: "Rate limits and policy violations are reported",
  },
  {
    from: "developer-experience",
    to: "app",
    why: "Coding agents extend the app with tests and docs to follow",
  },
  {
    from: "agents-mcp",
    to: "app",
    why: "Agent tools call the same API as the app",
  },
];

/** The site URL of a docs slug. */
export function docsHref(slug: string): string {
  return slug === "" ? "/docs/" : `/docs/${slug}/`;
}

export function pillar(id: PillarId): Pillar {
  const found = PILLARS.find((entry) => entry.id === id);
  if (!found) throw new Error(`No pillar ${id}`);
  return found;
}

export function group(id: GroupId): Group {
  const found = GROUPS.find((entry) => entry.id === id);
  if (!found) throw new Error(`No group ${id}`);
  return found;
}

export function feature(id: FeatureId): Feature {
  const found = FEATURES.find((entry) => entry.id === id);
  if (!found) throw new Error(`No feature ${id}`);
  return found;
}

export function groupsOf(pillarId: PillarId): readonly Group[] {
  return GROUPS.filter((entry) => entry.pillar === pillarId);
}

export function featuresOf(groupId: GroupId): readonly Feature[] {
  return FEATURES.filter((entry) => entry.group === groupId);
}

/** The 3 to 6 features a group's card lists. */
export function highlightsOf(groupId: GroupId): readonly Feature[] {
  return group(groupId).highlights.map(feature);
}

/** The features a feature works with, and why. */
export function worksWith(
  id: FeatureId
): readonly { readonly feature: Feature; readonly why: string }[] {
  return EDGES.filter((edge) => edge.a === id || edge.b === id).map((edge) => ({
    feature: feature(edge.a === id ? edge.b : edge.a),
    why: edge.why,
  }));
}
