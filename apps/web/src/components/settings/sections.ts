export interface SettingsVisibility {
  readonly mode: "personal" | "single" | "multi";
  readonly role?: string;
  readonly hasWorkspace: boolean;
}
export interface SettingsSection {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly group: "account" | "workspace";
  readonly visible: (context: SettingsVisibility) => boolean;
}

/** Product extensions add a section here and its route in routes.tsx. Permissions stay server-side. */
export const settingsSections: readonly SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    to: "/app/settings/account",
    group: "account",
    visible: () => true,
  },
  {
    id: "appearance",
    label: "Appearance & language",
    to: "/app/settings/appearance",
    group: "account",
    visible: () => true,
  },
  {
    id: "security",
    label: "Security",
    to: "/app/settings/security",
    group: "account",
    visible: () => true,
  },
  {
    id: "workspace",
    label: "Workspace",
    to: "/app/settings/workspace",
    group: "workspace",
    visible: (context) => context.hasWorkspace,
  },
];
