import type { Meta, StoryObj } from "@storybook/react-vite";
import { Columns3, List, ListFilter, SlidersHorizontal } from "lucide-react";

import { Button } from "../button";
import { Text } from "../typography";
import {
  AppBreadcrumb,
  AppShell,
  AppTopBar,
  TeamIcon,
  ViewSwitch,
} from "./app-shell";
import { DemoSidebar, issues } from "./fixtures";
import { IssueList } from "./issue-list";

/**
 * The app frame: a collapsible sidebar (workspace switcher, Inbox / My issues / Views, your
 * teams, help) and an inset main panel with a top bar. Press `[` to collapse the sidebar to
 * icons (tooltips show the names); below 768px it becomes a drawer opened from the top bar.
 *
 * Compose it from `Sidebar`, `SidebarHeader`, `SidebarWorkspaceSwitcher`, `SidebarContent`,
 * `SidebarSection`, `SidebarItem`, `SidebarTeam`, `SidebarFooter`, and `AppTopBar` with
 * `AppBreadcrumb` and `ViewSwitch`. `useAppShell()` reads and drives the sidebar state.
 */
const meta = {
  title: "Patterns/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    defaultCollapsed: false,
    sidebar: <DemoSidebar />,
    children: null,
  },
  argTypes: {
    sidebar: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function TopBar() {
  return (
    <AppTopBar
      title={
        <AppBreadcrumb
          items={[
            <>
              <TeamIcon name="Engineering" />
              Engineering
            </>,
            "Active issues",
          ]}
        />
      }
      actions={
        <>
          <ViewSwitch
            options={[
              { value: "list", label: "List", icon: <List /> },
              { value: "board", label: "Board", icon: <Columns3 /> },
            ]}
          />
          <Button variant="ghost" size="sm" icon={<ListFilter />}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" icon={<SlidersHorizontal />}>
            Display
          </Button>
        </>
      }
    />
  );
}

export const Playground: Story = {
  render: (args) => (
    <AppShell {...args}>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <IssueList issues={issues} />
      </div>
    </AppShell>
  ),
};

export const Collapsed: Story = {
  args: { defaultCollapsed: true },
  render: Playground.render,
};

export const EmptyPage: Story = {
  render: (args) => (
    <AppShell {...args} sidebar={<DemoSidebar active="inbox" />}>
      <AppTopBar title={<AppBreadcrumb items={["Inbox"]} />} />
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <Text weight="medium">You're all caught up</Text>
        <Text tone="subtle">
          New mentions, assignments and replies land here.
        </Text>
      </div>
    </AppShell>
  ),
};

/** Below 768px the sidebar is a drawer: use the button at the top left. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: Playground.render,
};
