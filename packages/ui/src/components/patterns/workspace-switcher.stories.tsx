import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogOut, UserRound } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  AppShell,
  Sidebar,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenuLabel,
} from "./app-shell";
import { type WorkspaceOption, WorkspaceSwitcher } from "./workspace-switcher";

/**
 * The sidebar's workspace menu. In multi-workspace apps it lists the user's workspaces
 * (their role on the right), switches between them and creates new ones; with one
 * workspace per user or per app it shows the name and the account items only.
 */
const meta = {
  title: "Patterns/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    workspaces: [
      { id: "ws-personal", name: "Personal", kind: "personal", role: "owner" },
      { id: "ws-acme", name: "Acme Robotics", kind: "shared", role: "owner" },
      {
        id: "ws-lab",
        name: "Analytical Engines",
        kind: "shared",
        role: "member",
      },
    ] satisfies WorkspaceOption[],
    activeId: "ws-acme",
    onSwitch: fn(),
    onCreate: fn(async () => {}),
  },
  render: (args) => (
    <AppShell
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <WorkspaceSwitcher {...args}>
              <SidebarMenuLabel>ada@acme.test</SidebarMenuLabel>
              <SidebarMenuItem icon={<UserRound />}>Profile</SidebarMenuItem>
              <SidebarMenuItem icon={<LogOut />}>Sign out</SidebarMenuItem>
            </WorkspaceSwitcher>
          </SidebarHeader>
        </Sidebar>
      }
    >
      <div className="p-6 text-sm text-fg-muted">Workspace content</div>
    </AppShell>
  ),
} satisfies Meta<typeof WorkspaceSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Several workspaces (multi mode). */
export const MultiWorkspace: Story = {};

/** One workspace per user or per app (personal and single mode): name and account only. */
export const SingleWorkspace: Story = {
  args: {
    workspaces: [
      { id: "ws-acme", name: "Acme Robotics", kind: "shared", role: "member" },
    ],
    activeId: "ws-acme",
    onSwitch: undefined,
    onCreate: undefined,
  },
};

/** Opening the menu and picking another workspace reports its id. */
export const SwitchWorkspace: Story = {
  // An open Radix DropdownMenu hides the page with aria-hidden but leaves the trigger
  // focusable; axe reports aria-hidden-focus (see dropdown-menu.stories.tsx).
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: /Acme Robotics workspace menu/ })
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: /Analytical Engines/ })
    );
    await expect(args.onSwitch).toHaveBeenCalledWith("ws-lab");
  },
};

/** "Create workspace" asks for a name, refuses a blank one and reports the name. */
export const CreateWorkspace: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: /workspace menu/ })
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Create workspace" })
    );
    const dialog = await page.findByRole("dialog", {
      name: "Create workspace",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create" })
    );
    await expect(
      await within(dialog).findByText("Give the workspace a name")
    ).toBeVisible();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Difference Engine"
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create" })
    );
    await expect(args.onCreate).toHaveBeenCalledWith("Difference Engine");
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};
