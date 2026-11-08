import { clientCan } from "@/lib/workspace-permissions";

export interface SettingsVisibility {
  readonly mode: "personal" | "single" | "multi";
  readonly role?: string;
  readonly hasWorkspace: boolean;
}
export interface SettingsSection {
  readonly id: string;
  /** In the settings navigation. */
  readonly label: string;
  /** In the app's top bar. */
  readonly title: string;
  readonly to: string;
  readonly group: "account" | "workspace";
  /** More words the command palette matches. */
  readonly keywords?: readonly string[];
  readonly visible: (context: SettingsVisibility) => boolean;
}

/**
 * Product extensions add a section here and its route in routes.tsx; the settings
 * navigation, the top bar title and the command palette read this list
 * (components/app/navigation.ts). Hiding a section is a convenience: permissions stay
 * server-side.
 */
export const settingsSections: readonly SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    title: "Account settings",
    to: "/app/settings/account",
    group: "account",
    keywords: ["profile", "name", "email", "avatar"],
    visible: () => true,
  },
  {
    id: "appearance",
    label: "Appearance & language",
    title: "Appearance & language",
    to: "/app/settings/appearance",
    group: "account",
    keywords: ["theme", "dark", "light", "time zone", "locale"],
    visible: () => true,
  },
  {
    id: "security",
    label: "Security",
    title: "Security",
    to: "/app/settings/security",
    group: "account",
    keywords: ["password", "passkey", "two-factor", "sessions"],
    visible: () => true,
  },
  {
    id: "connected-agents",
    label: "Connected agents",
    title: "Connected agents",
    to: "/app/settings/connected-agents",
    group: "account",
    keywords: ["MCP", "agents", "Claude", "OAuth", "apps", "disconnect"],
    visible: () => true,
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Privacy",
    to: "/app/settings/privacy",
    group: "account",
    keywords: ["export", "data", "delete account"],
    visible: () => true,
  },
  {
    id: "workspace",
    label: "Workspace",
    title: "Workspace settings",
    to: "/app/settings/workspace",
    group: "workspace",
    keywords: ["rename", "logo", "delete workspace"],
    // Only roles that may manage the workspace: the page has nothing for the others.
    visible: (context) =>
      context.hasWorkspace && clientCan(context.role, "workspace.manage"),
  },
];
