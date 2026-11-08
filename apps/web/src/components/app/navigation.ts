/**
 * Every destination of the signed-in app: the one list the sidebar, the top bar title and
 * the command palette read, so they cannot drift. A new page adds its route in routes.tsx
 * and an entry here (settings sections go in components/settings/sections.ts, which is
 * spliced in below); navigation.test.ts fails when a route has no entry. Visibility is a
 * convenience for the user: the server checks every permission again.
 */
import { settingsSections } from "@/components/settings/sections";
import { clientCan } from "@/lib/workspace-permissions";

/** What decides which destinations a user sees. */
export interface NavContext {
  /** WORKSPACE_MODE. */
  readonly mode: "personal" | "single" | "multi";
  /** The active workspace, or null when the user has none. */
  readonly workspace: {
    readonly kind: "personal" | "shared";
    readonly role: string;
  } | null;
  /** BILLING. */
  readonly billingMode: "off" | "manual" | "provider";
  /** May open the admin portal: a platform admin while ADMIN_PORTAL is on. */
  readonly admin: boolean;
}

/** Where an entry sits in the sidebar; `null` keeps it out of the sidebar. */
export type SidebarGroup = "main" | "product" | "admin" | "demos";

/** The icon an entry shows (mapped to a lucide icon in nav-icons.tsx). */
export type NavIcon =
  | "dashboard"
  | "members"
  | "billing"
  | "trash"
  | "settings"
  | "notes"
  | "tasks"
  | "notifications"
  | "admin"
  | "demos"
  | "upload"
  | "queue"
  | "email";

export interface AppDestination {
  readonly id: string;
  /** In the sidebar and the command palette. */
  readonly label: string;
  /** In the top bar while the page is open; destinations of another document have none. */
  readonly title?: string;
  readonly to: string;
  readonly icon: NavIcon;
  readonly sidebar: SidebarGroup | null;
  /** Listed in the command palette (false for the sidebar's shortcut to a section). */
  readonly palette: boolean;
  /** A full page load: the server checks access before serving it (the admin portal). */
  readonly document?: boolean;
  /** The sidebar marks it active for every path below `to`'s section, not only `to`. */
  readonly activePrefix?: string;
  /** More words the command palette matches. */
  readonly keywords?: readonly string[];
  readonly visible: (context: NavContext) => boolean;
}

const always = () => true;
const sharedWorkspace = (context: NavContext) =>
  context.mode !== "personal" && context.workspace?.kind === "shared";

/**
 * In command palette order. Within each sidebar section the order is the sidebar's.
 */
export const appDestinations: readonly AppDestination[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Dashboard",
    to: "/app/dashboard",
    icon: "dashboard",
    sidebar: "main",
    palette: true,
    keywords: ["home", "getting started"],
    visible: always,
  },
  {
    id: "notes",
    label: "Notes",
    title: "Notes",
    to: "/app/notes",
    icon: "notes",
    sidebar: "product",
    palette: true,
    activePrefix: "/app/notes",
    // Hidden only from a role that may not read notes (not while workspaces load).
    visible: (context) =>
      context.workspace === null ||
      clientCan(context.workspace.role, "notes.read"),
  },
  {
    id: "tasks",
    label: "Tasks",
    title: "Tasks",
    to: "/app/tasks",
    icon: "tasks",
    sidebar: "product",
    palette: true,
    keywords: ["issues", "board", "kanban"],
    visible: always,
  },
  {
    id: "notifications",
    label: "Notifications",
    title: "Notifications",
    to: "/app/notifications",
    icon: "notifications",
    sidebar: null,
    palette: true,
    keywords: ["inbox"],
    visible: always,
  },
  {
    id: "notification-preferences",
    label: "Notification settings",
    title: "Notification settings",
    to: "/app/notifications/preferences",
    icon: "notifications",
    sidebar: null,
    palette: true,
    keywords: ["email", "digest", "preferences"],
    visible: always,
  },
  {
    id: "members",
    label: "Members",
    title: "Members",
    to: "/app/members",
    icon: "members",
    sidebar: "main",
    palette: true,
    keywords: ["people", "team", "invitations"],
    visible: sharedWorkspace,
  },
  {
    id: "billing",
    label: "Billing",
    title: "Billing",
    to: "/app/billing",
    icon: "billing",
    sidebar: "main",
    palette: true,
    keywords: ["plan", "subscription", "upgrade", "usage"],
    visible: (context) => context.billingMode !== "off",
  },
  {
    id: "trash",
    label: "Trash",
    title: "Trash",
    to: "/app/trash",
    icon: "trash",
    sidebar: "main",
    palette: true,
    keywords: ["deleted", "restore"],
    visible: always,
  },
  {
    // The sidebar's way into settings; the palette lists each section instead.
    id: "settings",
    label: "Settings",
    to: "/app/settings/account",
    icon: "settings",
    sidebar: "main",
    palette: false,
    activePrefix: "/app/settings",
    visible: always,
  },
  ...settingsSections.map(
    (section): AppDestination => ({
      id: `settings-${section.id}`,
      label: `Settings: ${section.label}`,
      title: section.title,
      to: section.to,
      icon: "settings",
      sidebar: null,
      palette: true,
      keywords: section.keywords,
      visible: (context) =>
        section.visible({
          mode: context.mode,
          role: context.workspace?.role,
          hasWorkspace: context.workspace !== null,
        }),
    })
  ),
  {
    id: "admin",
    label: "Admin",
    to: "/admin/overview",
    icon: "admin",
    sidebar: "admin",
    palette: true,
    document: true,
    keywords: ["portal", "users", "audit"],
    visible: (context) => context.admin,
  },
  {
    id: "demos",
    label: "Developer demos",
    title: "Developer demos",
    to: "/app/demos",
    icon: "demos",
    sidebar: null,
    palette: true,
    visible: always,
  },
  {
    id: "upload-demo",
    label: "Upload",
    title: "Upload demo",
    to: "/app/upload-demo",
    icon: "upload",
    sidebar: "demos",
    palette: true,
    keywords: ["demo", "files", "r2"],
    visible: always,
  },
  {
    id: "queue-demo",
    label: "Queue",
    title: "Queue demo",
    to: "/app/queue-demo",
    icon: "queue",
    sidebar: "demos",
    palette: true,
    keywords: ["demo", "jobs"],
    visible: always,
  },
  {
    id: "email-demo",
    label: "Email",
    title: "Email demo",
    to: "/app/email-demo",
    icon: "email",
    sidebar: "demos",
    palette: true,
    keywords: ["demo", "mail"],
    visible: always,
  },
];

/** The destinations a user sees, in palette order. */
export function visibleDestinations(
  context: NavContext,
  destinations: readonly AppDestination[] = appDestinations
): readonly AppDestination[] {
  return destinations.filter((destination) => destination.visible(context));
}

/** One sidebar section's entries for this user, in sidebar order. */
export function sidebarDestinations(
  context: NavContext,
  section: SidebarGroup
): readonly AppDestination[] {
  return visibleDestinations(context).filter(
    (destination) => destination.sidebar === section
  );
}

/** The command palette's Navigate group for this user. */
export function paletteDestinations(
  context: NavContext
): readonly AppDestination[] {
  return visibleDestinations(context).filter(
    (destination) => destination.palette
  );
}

/** Whether the sidebar marks `destination` as the current page. */
export function isActiveDestination(
  destination: AppDestination,
  pathname: string
): boolean {
  if (destination.activePrefix) {
    return (
      pathname === destination.activePrefix ||
      pathname.startsWith(`${destination.activePrefix}/`)
    );
  }
  return pathname === destination.to;
}

/** The top bar title of a path, or null for a path no destination is (a 404). */
export function destinationTitle(pathname: string): string | null {
  const exact = appDestinations.find(
    (destination) => destination.title && destination.to === pathname
  );
  if (exact?.title) return exact.title;
  if (pathname.startsWith("/app/notes/")) return "Note";
  return null;
}
