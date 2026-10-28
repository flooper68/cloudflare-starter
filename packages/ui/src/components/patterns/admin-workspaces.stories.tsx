import type { Meta, StoryObj } from "@storybook/react-vite";
import { Building2 } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Card } from "../card";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminWorkspaceDetail,
  type AdminWorkspaceDetailData,
  AdminWorkspaceDetailSkeleton,
  type AdminWorkspaceRow,
  AdminWorkspacesTable,
} from "./admin-workspaces";

const ago = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

const workspaces: AdminWorkspaceRow[] = [
  {
    id: "ws-a",
    name: "Acme Robotics",
    kind: "shared",
    createdAt: ago(40),
    memberCount: 12,
    managerCount: 2,
  },
  {
    id: "ws-o",
    name: "Orphaned Labs",
    kind: "shared",
    createdAt: ago(20),
    memberCount: 3,
    managerCount: 0,
  },
  {
    id: "ws-g",
    name: "Grace",
    kind: "personal",
    createdAt: ago(5),
    memberCount: 1,
    managerCount: 1,
  },
];

const orphan: AdminWorkspaceDetailData = {
  id: "ws-o",
  name: "Orphaned Labs",
  kind: "shared",
  createdAt: ago(20),
  managerCount: 0,
  pendingInvitations: 1,
  members: [
    {
      userId: "u-mia",
      name: "Mia Member",
      email: "mia@orphaned.test",
      role: "member",
      joinedAt: ago(19),
    },
    {
      userId: "u-tom",
      name: "Tom Tester",
      email: "tom@orphaned.test",
      role: "member",
      joinedAt: ago(10),
    },
  ],
};

/**
 * Workspaces in the admin portal: the server-paged list (flags those without an owner)
 * and one workspace with its members, owner rescue and deletion.
 */
const meta = {
  title: "Patterns/Admin/Workspaces",
  component: AdminWorkspacesTable,
  tags: ["autodocs"],
  args: { workspaces, onOpen: fn() },
  render: (args) => (
    <Card className="w-[880px] p-0">
      <AdminWorkspacesTable {...args} />
    </Card>
  ),
} satisfies Meta<typeof AdminWorkspacesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The list. */
export const List: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No owner")).toBeVisible();
    await userEvent.click(canvas.getByText("Orphaned Labs"));
    await expect(args.onOpen).toHaveBeenCalledWith("ws-o");
  },
};

/** Nothing matches. */
export const ListEmpty: Story = { args: { workspaces: [] } };

const detailActions = {
  onAssignOwner: fn(async () => {}),
  onDelete: fn(async () => {}),
  onOpenUser: fn(),
};

/** A workspace with an owner: members and "Delete workspace". */
export const Detail: Story = {
  render: () => (
    <div className="w-[880px]">
      <AdminWorkspaceDetail
        workspace={{
          ...orphan,
          name: "Acme Robotics",
          managerCount: 1,
          members: [
            {
              ...(orphan
                .members[0] as AdminWorkspaceDetailData["members"][number]),
              role: "owner",
            },
            ...orphan.members.slice(1),
          ],
        }}
        {...detailActions}
      />
    </div>
  ),
};

/** A workspace without an owner: make a member its owner after confirming. */
export const RescueOwner: Story = {
  render: () => (
    <div className="w-[880px]">
      <AdminWorkspaceDetail workspace={orphan} {...detailActions} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByText("Nobody can manage this workspace")
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Make owner Mia Member" })
    );
    const confirm = await page.findByRole("alertdialog", {
      name: "Make Mia Member the owner?",
    });
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Make owner" })
    );
    await waitFor(() =>
      expect(detailActions.onAssignOwner).toHaveBeenCalledWith("u-mia")
    );
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[880px]">
      <DataState
        status={status}
        data={undefined as AdminWorkspaceDetailData | undefined}
        error={new Error("Workspace not found")}
        onRetry={() => {}}
        loading={<AdminWorkspaceDetailSkeleton />}
        empty={<EmptyState icon={<Building2 />} title="Workspace not found" />}
      >
        {(workspace) => (
          <AdminWorkspaceDetail workspace={workspace} {...detailActions} />
        )}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
