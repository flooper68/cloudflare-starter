import type { Meta, StoryObj } from "@storybook/react-vite";
import { Users } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Card } from "../card";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminUserFilterBar,
  type AdminUserFilters,
  type AdminUserRow,
  AdminUsersTable,
} from "./admin-users-table";
import { MembersTableSkeleton } from "./members-table";

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

const users: AdminUserRow[] = [
  {
    id: "u-ada",
    name: "Ada Lovelace",
    email: "ada@acme.test",
    emailVerified: true,
    role: "admin",
    banned: false,
    createdAt: ago(120),
    lastSeenAt: ago(0.01),
  },
  {
    id: "u-grace",
    name: "Grace Hopper",
    email: "grace@acme.test",
    emailVerified: true,
    role: "user",
    banned: true,
    createdAt: ago(60),
    lastSeenAt: ago(3),
  },
  {
    id: "u-alan",
    name: "Alan Turing",
    email: "alan@acme.test",
    emailVerified: false,
    role: "user",
    banned: false,
    createdAt: ago(2),
    lastSeenAt: null,
  },
];

/**
 * The admin user list: search and filter chips over a server-paged table. Rows open the
 * user; "Load more" fetches the next page.
 */
const meta = {
  title: "Patterns/Admin/UsersTable",
  component: AdminUsersTable,
  tags: ["autodocs"],
  args: { users, onOpen: fn(), onLoadMore: fn() },
  render: (args) => (
    <Card className="w-[960px] p-0">
      <AdminUsersTable {...args} />
    </Card>
  ),
} satisfies Meta<typeof AdminUsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One page of users with more to load. */
export const Content: Story = {};

/** Clicking a row opens the user; "Load more" asks for the next page. */
export const OpenAndLoadMore: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Grace Hopper"));
    await expect(args.onOpen).toHaveBeenCalledWith("u-grace");
    await userEvent.click(canvas.getByRole("button", { name: "Load more" }));
    await expect(args.onLoadMore).toHaveBeenCalled();
    await expect(canvas.getByText("Suspended")).toBeVisible();
    await expect(canvas.getByText("Unverified")).toBeVisible();
  },
};

/** Nothing matches the filters. */
export const NoMatches: Story = {
  args: { users: [], onLoadMore: undefined },
};

function UserFiltersExample() {
  const [value, setValue] = useState<AdminUserFilters>({ search: "" });
  return (
    <div className="flex w-[960px] flex-col gap-3">
      <AdminUserFilterBar value={value} onValueChange={setValue} />
      <output aria-label="Current filters" className="text-xs text-fg-muted">
        {JSON.stringify(value)}
      </output>
    </div>
  );
}

/** The search field and filter chips; the page sends them to the server. */
export const Filters: Story = {
  render: () => <UserFiltersExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), "grace");
    await expect(canvas.getByLabelText("Current filters")).toHaveTextContent(
      '"search":"grace"'
    );
  },
};

type PageStatus = "pending" | "error" | "empty";

function Page({ status }: { readonly status: PageStatus }) {
  return (
    <Card className="w-[960px] p-0">
      <DataState
        status={status === "empty" ? "success" : status}
        data={status === "empty" ? [] : undefined}
        error={new Error("The server didn't answer. Check your connection.")}
        onRetry={() => {}}
        isEmpty={(value: readonly AdminUserRow[]) => value.length === 0}
        loading={<MembersTableSkeleton rows={5} />}
        empty={
          <EmptyState
            variant="compact"
            icon={<Users />}
            title="No users yet"
            description="People appear here when they sign up."
          />
        }
      >
        {(value) => <AdminUsersTable users={value} onOpen={() => {}} />}
      </DataState>
    </Card>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
/** No users at all. */
export const Empty: Story = { render: () => <Page status="empty" /> };
