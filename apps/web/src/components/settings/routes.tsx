import { createRoute, redirect } from "@tanstack/react-router";
import { appLayoutRoute } from "@/components/app/layout-route";
import { AccountSettingsPage } from "./pages/AccountSettingsPage";
import { AppearanceSettingsPage } from "./pages/AppearanceSettingsPage";
import { ConnectedAgentsSettingsPage } from "./pages/ConnectedAgentsSettingsPage";
import { PrivacySettingsPage } from "./pages/PrivacySettingsPage";
import { SecuritySettingsPage } from "./pages/SecuritySettingsPage";
import { WorkspaceSettingsPage } from "./pages/WorkspaceSettingsPage";
import { SettingsLayout } from "./SettingsLayout";

export const settingsLayoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/settings",
  component: SettingsLayout,
});
const index = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/account" });
  },
});
const account = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "account",
  component: AccountSettingsPage,
});
const appearance = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "appearance",
  component: AppearanceSettingsPage,
});
const security = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "security",
  component: SecuritySettingsPage,
});
const connectedAgents = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "connected-agents",
  component: ConnectedAgentsSettingsPage,
});
const workspace = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "workspace",
  component: WorkspaceSettingsPage,
});
const privacy = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "privacy",
  component: PrivacySettingsPage,
});
export const settingsRoutes = [
  index,
  account,
  appearance,
  security,
  connectedAgents,
  workspace,
  privacy,
];
