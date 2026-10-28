import type { Meta, StoryObj } from "@storybook/react-vite";
import { Users } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Card } from "../card";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { InviteDialog } from "./invite-dialog";
import {
  type InvitationRow,
  type MemberRow,
  MembersTable,
  MembersTableSkeleton,
} from "./members-table";

const roles = [
  { value: "owner", label: "Owner" },
  { value: "member", label: "Member" },
];

const members: MemberRow[] = [
  {
    userId: "u-ada",
    name: "Ada Lovelace",
    email: "ada@acme.test",
    role: "owner",
  },
  {
    userId: "u-grace",
    name: "Grace Hopper",
    email: "grace@acme.test",
    role: "member",
  },
  {
    userId: "u-alan",
    name: "Alan Turing",
    email: "alan@acme.test",
    role: "member",
  },
];

const invitations: InvitationRow[] = [
  {
    id: "inv-1",
    email: "barbara@acme.test",
    role: "member",
    status: "pending",
  },
  { id: "inv-2", email: "ken@acme.test", role: "owner", status: "expired" },
];

/**
 * The people in a workspace and its open invitations. Owners change roles, remove members
 * (after a confirmation) and revoke invitations; members see a read-only list. The page
 * wraps it in `DataState` for loading, empty and error.
 */
const meta = {
  title: "Patterns/MembersTable",
  component: MembersTable,
  tags: ["autodocs"],
  args: {
    members,
    invitations,
    roles,
    currentUserId: "u-ada",
    canManage: true,
    onChangeRole: fn(),
    onRemove: fn(),
    onRevoke: fn(),
  },
  render: (args) => (
    <Card className="w-[720px] p-0">
      <MembersTable {...args} />
    </Card>
  ),
} satisfies Meta<typeof MembersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What an owner sees. */
export const OwnerView: Story = {};

/** What a member sees: names, emails and roles, nothing to change. */
export const MemberView: Story = {
  args: { currentUserId: "u-grace", canManage: false, invitations: [] },
};

/** "Remove" asks first; confirming reports the member. Revoke reports the invitation. */
export const RemoveAndRevoke: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Grace Hopper" })
    );
    const confirm = await page.findByRole("alertdialog", {
      name: "Remove Grace Hopper?",
    });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Remove" })
    );
    await expect(args.onRemove).toHaveBeenCalledWith("u-grace");
    await waitFor(() => expect(page.queryByRole("alertdialog")).toBeNull());

    await userEvent.click(
      canvas.getByRole("button", {
        name: "Revoke invitation for barbara@acme.test",
      })
    );
    await expect(args.onRevoke).toHaveBeenCalledWith("inv-1");
    await expect(
      canvas.queryByRole("button", { name: /Remove Ada Lovelace/ })
    ).toBeNull();
  },
};

type PageStatus = "pending" | "error" | "empty" | "success";

/** The members page body: header with "Invite people", then the four data states. */
function MembersPage({ status }: { readonly status: PageStatus }) {
  const data =
    status === "success"
      ? { members, invitations }
      : status === "empty"
        ? { members: [], invitations: [] }
        : undefined;
  return (
    <div className="flex w-[760px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Members</h2>
        <InviteDialog
          roles={roles}
          defaultRole="member"
          workspaceName="Acme Robotics"
          onInvite={async () => {}}
        />
      </div>
      <Card className="p-0">
        <DataState
          status={status === "empty" ? "success" : status}
          data={data}
          error={new Error("The server didn't answer. Check your connection.")}
          onRetry={() => {}}
          isEmpty={(value) =>
            value.members.length === 0 && value.invitations.length === 0
          }
          loading={<MembersTableSkeleton />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Users />}
              title="Just you so far"
              description="Invite people to share this workspace's files."
            />
          }
        >
          {(value) => (
            <MembersTable
              members={value.members}
              invitations={value.invitations}
              roles={roles}
              currentUserId="u-ada"
              canManage
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/** Members page: loading. */
export const PageLoading: Story = {
  render: () => <MembersPage status="pending" />,
};

/** Members page: failed to load, with retry. */
export const PageError: Story = {
  render: () => <MembersPage status="error" />,
};

/** Members page: nobody else yet. */
export const PageEmpty: Story = {
  render: () => <MembersPage status="empty" />,
};

/** Members page: content. */
export const PageContent: Story = {
  render: () => <MembersPage status="success" />,
};
