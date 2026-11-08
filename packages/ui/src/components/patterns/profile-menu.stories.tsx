import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bell,
  BookOpen,
  Bot,
  CircleUserRound,
  KeyRound,
  Layers,
  LogOut,
  ShieldCheck,
  SunMoon,
  UserRoundX,
} from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  AppShell,
  AppTopBar,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuItem,
  SidebarMenuSeparator,
  SidebarWorkspaceSwitcher,
} from "./app-shell";
import { ProfileMenu, type ProfileMenuProps } from "./profile-menu";

// An open Radix DropdownMenu hides the page with aria-hidden but leaves the trigger
// focusable; axe reports aria-hidden-focus (see dropdown-menu.stories.tsx).
const openMenu = {
  a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
};

interface StoryArgs extends ProfileMenuProps {
  readonly admin?: boolean;
  readonly impersonating?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly onSignOut?: () => void;
}

/** The app's menu, in the app's order: own pages, help, admin, sign out last. */
function MenuItems({
  admin = false,
  impersonating = false,
  onSignOut,
}: Pick<StoryArgs, "admin" | "impersonating" | "onSignOut">) {
  return (
    <>
      <SidebarMenuItem icon={<CircleUserRound />}>
        Account settings
      </SidebarMenuItem>
      <SidebarMenuItem icon={<KeyRound />}>Security</SidebarMenuItem>
      <SidebarMenuItem icon={<Bot />}>Connected agents</SidebarMenuItem>
      <SidebarMenuItem icon={<Bell />}>Notifications</SidebarMenuItem>
      <SidebarMenuItem icon={<SunMoon />}>Appearance</SidebarMenuItem>
      <SidebarMenuSeparator />
      <SidebarMenuItem icon={<Layers />}>Component library</SidebarMenuItem>
      <SidebarMenuItem asChild icon={<BookOpen />}>
        <a href="#docs">Docs</a>
      </SidebarMenuItem>
      {admin ? (
        <>
          <SidebarMenuSeparator />
          <SidebarMenuItem icon={<ShieldCheck />}>Admin portal</SidebarMenuItem>
        </>
      ) : null}
      <SidebarMenuSeparator />
      {impersonating ? (
        <SidebarMenuItem icon={<UserRoundX />}>
          Stop impersonating
        </SidebarMenuItem>
      ) : null}
      <SidebarMenuItem icon={<LogOut />} onSelect={onSignOut}>
        Sign out
      </SidebarMenuItem>
    </>
  );
}

/**
 * The account menu in the sidebar footer. The avatar and name open it upward: the
 * person's name and email, their own pages, the component library and docs, the admin
 * portal for admins, and Sign out last. Collapsed it is the avatar with a tooltip; in the
 * mobile drawer it works the same and closes the drawer on a pick. Workspace items stay in
 * `WorkspaceSwitcher` at the top.
 */
const meta = {
  title: "Patterns/ProfileMenu",
  component: ProfileMenu,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    name: "Ada Lovelace",
    email: "ada@analytical.test",
    children: null,
    admin: false,
    impersonating: false,
    defaultCollapsed: false,
    onSignOut: fn(),
  },
  argTypes: { children: { control: false } },
  render: ({
    admin,
    impersonating,
    defaultCollapsed,
    onSignOut,
    ...args
  }: StoryArgs) => (
    <AppShell
      defaultCollapsed={defaultCollapsed}
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarWorkspaceSwitcher name="Acme Robotics" />
          </SidebarHeader>
          <SidebarContent>{null}</SidebarContent>
          <SidebarFooter>
            <ProfileMenu {...args}>
              <MenuItems
                admin={admin}
                impersonating={impersonating}
                onSignOut={onSignOut}
              />
            </ProfileMenu>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <AppTopBar title="Dashboard" />
      <div className="p-6 text-sm text-fg-muted">Workspace content</div>
    </AppShell>
  ),
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger in the footer: avatar and name. */
export const Default: Story = {};

/** Open: the header with name and email, then the items, Sign out last. */
export const Open: Story = {
  args: { defaultOpen: true },
  parameters: openMenu,
};

/** An admin with the admin portal on also gets "Admin portal". */
export const Admin: Story = {
  args: { defaultOpen: true, admin: true },
  parameters: openMenu,
};

/** While an admin impersonates someone: that person's menu, with Stop impersonating. */
export const Impersonating: Story = {
  args: { defaultOpen: true, impersonating: true, name: "Grace Hopper" },
  parameters: openMenu,
};

/** Collapsed sidebar: the avatar alone, the name in a tooltip; the menu opens to the right. */
export const Collapsed: Story = {
  args: { defaultCollapsed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", {
      name: "Ada Lovelace profile menu",
    });
    await userEvent.hover(trigger);
    await expect(
      await page.findByRole("tooltip", { name: "Ada Lovelace" })
    ).toBeInTheDocument();
  },
};

/** Collapsed and open. */
export const CollapsedOpen: Story = {
  args: { defaultCollapsed: true, defaultOpen: true },
  parameters: openMenu,
};

/** Long names and emails truncate in the trigger and the header (full text on hover). */
export const LongNameAndEmail: Story = {
  args: {
    defaultOpen: true,
    name: "Maximiliana Wilhelmina Theodora von Hohenzollern-Sigmaringen",
    email:
      "maximiliana.wilhelmina.von.hohenzollern@engineering.analytical.test",
  },
  parameters: openMenu,
};

/** Without a name the email stands in. */
export const EmailOnly: Story = {
  args: { name: "", email: "ada@analytical.test" },
};

/** Below 768px: open the drawer, then the menu; a pick closes the drawer. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: openMenu,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open navigation" })
    );
    const drawer = await page.findByRole("dialog", { name: "Navigation" });
    await userEvent.click(
      within(drawer).getByRole("button", { name: /profile menu/ })
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Sign out" })
    );
    await expect(args.onSignOut).toHaveBeenCalled();
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};

/**
 * Keyboard: Enter opens it with focus on the first item, arrows move, Escape closes it and
 * returns focus to the trigger; the header names the person.
 */
export const KeyboardAndFocusReturn: Story = {
  parameters: openMenu,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", {
      name: "Ada Lovelace profile menu",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = await page.findByRole("menu");
    await expect(menu).toHaveTextContent("ada@analytical.test");
    await waitFor(() =>
      expect(
        page.getByRole("menuitem", { name: "Account settings" })
      ).toHaveFocus()
    );
    await userEvent.keyboard("{ArrowDown}");
    await expect(
      page.getByRole("menuitem", { name: "Security" })
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(args.onSignOut).not.toHaveBeenCalled();
  },
};
