import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { AdminReauthDialog } from "./admin-reauth-dialog";
import {
  AdminUserDetail,
  type AdminUserDetailData,
  AdminUserDetailSkeleton,
} from "./admin-user-detail";

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const grace: AdminUserDetailData = {
  id: "u-grace",
  name: "Grace Hopper",
  email: "grace@acme.test",
  emailVerified: true,
  image: null,
  role: "user",
  ban: { active: false, reason: null, expiresAt: null },
  signInMethods: ["credential", "google"],
  createdAt: ago(60 * 24 * 90),
  lastSeenAt: ago(4),
  workspaces: [
    { id: "ws-g", name: "Grace", kind: "personal", role: "owner" },
    { id: "ws-a", name: "Acme Robotics", kind: "shared", role: "member" },
  ],
  sessions: [
    {
      id: "s-1",
      createdAt: ago(30),
      lastActiveAt: ago(4),
      ipAddress: "203.0.113.24",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1.15",
      impersonatedBy: null,
    },
    {
      id: "s-2",
      createdAt: ago(60 * 26),
      lastActiveAt: ago(60 * 20),
      ipAddress: "198.51.100.7",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148",
      impersonatedBy: null,
    },
  ],
};

const actions = {
  onBan: fn(async () => {}),
  onUnban: fn(async () => {}),
  onRevokeSessions: fn(async () => {}),
  onSetRole: fn(async () => {}),
  onSendPasswordReset: fn(async () => {}),
  onImpersonate: fn(async () => {}),
  onRemove: fn(async () => {}),
  onOpenWorkspace: fn(),
};

/**
 * One user in the admin portal: profile, status, sign-in methods, workspaces and
 * sessions, with suspend, impersonate, sign out, password reset, role and delete. Every
 * destructive action asks first.
 */
const meta = {
  title: "Patterns/Admin/UserDetail",
  component: AdminUserDetail,
  tags: ["autodocs"],
  args: { user: grace, isSelf: false, ...actions },
  render: (args) => (
    <div className="w-[880px]">
      <AdminUserDetail {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminUserDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A regular, active user. */
export const Content: Story = {};

/** A suspended admin: lift the suspension; impersonation is not offered. */
export const SuspendedAdmin: Story = {
  args: {
    user: {
      ...grace,
      role: "admin",
      ban: {
        active: true,
        reason: "Shared credentials",
        expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      },
      sessions: [],
    },
  },
};

/** Your own account: nothing to act on. */
export const Yourself: Story = { args: { isSelf: true } };

/** "Suspend" asks for a reason and a duration, then reports them. */
export const Suspend: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Suspend" }));
    const dialog = await page.findByRole("dialog", {
      name: "Suspend Grace Hopper?",
    });
    await userEvent.type(
      within(dialog).getByLabelText("Reason"),
      "Spam invitations"
    );
    await userEvent.click(within(dialog).getByRole("combobox"));
    await userEvent.click(
      await page.findByRole("option", { name: "Until lifted" })
    );
    await userEvent.click(
      await within(dialog).findByRole("button", { name: "Suspend" })
    );
    await waitFor(() =>
      expect(args.onBan).toHaveBeenCalledWith({
        reason: "Spam invitations",
        expiresAt: null,
      })
    );
  },
};

/** Destructive actions ask first: deleting reports only after confirming. */
export const DeleteAfterConfirm: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete account" })
    );
    const confirm = await page.findByRole("alertdialog", {
      name: "Delete Grace Hopper's account?",
    });
    await expect(args.onRemove).not.toHaveBeenCalled();
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Delete account" })
    );
    await waitFor(() => expect(args.onRemove).toHaveBeenCalled());
  },
};

/** Impersonation asks first, then reports. */
export const Impersonate: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Impersonate" }));
    const confirm = await page.findByRole("alertdialog", {
      name: "Impersonate Grace Hopper?",
    });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Impersonate" })
    );
    await waitFor(() => expect(args.onImpersonate).toHaveBeenCalled());
  },
};

/** The prompt shown when the API wants a fresh sign-in (REAUTH_REQUIRED). */
export const ReauthPrompt: Story = {
  render: () => (
    <AdminReauthDialog open onOpenChange={() => {}} onSignIn={fn()} />
  ),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByRole("button", { name: "Sign in again" })
    ).toBeInTheDocument();
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[880px]">
      <DataState
        status={status}
        data={undefined as AdminUserDetailData | undefined}
        error={new Error("User not found")}
        onRetry={() => {}}
        loading={<AdminUserDetailSkeleton />}
        empty={<EmptyState title="User not found" />}
      >
        {(user) => <AdminUserDetail user={user} isSelf={false} {...actions} />}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load (deleted user, network). */
export const Failed: Story = { render: () => <Page status="error" /> };
