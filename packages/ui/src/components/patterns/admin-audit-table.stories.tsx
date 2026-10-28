import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollText } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Card } from "../card";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminAuditFilterBar,
  type AdminAuditFilters,
  type AdminAuditRow,
  AdminAuditTable,
} from "./admin-audit-table";
import { MembersTableSkeleton } from "./members-table";

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const events: AdminAuditRow[] = [
  {
    id: "e-3",
    occurredAt: ago(2),
    action: "user.banned",
    outcome: "success",
    actor: { kind: "admin", userId: "u-ada", impersonatorUserId: null },
    target: { type: "user", id: "u-grace" },
    workspaceId: null,
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  },
  {
    id: "e-2",
    occurredAt: ago(30),
    action: "workspace.invitation_created",
    outcome: "success",
    actor: { kind: "user", userId: "u-grace", impersonatorUserId: "u-ada" },
    target: { type: "invitation", id: "inv-1" },
    workspaceId: "ws-a",
    traceId: "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f",
  },
  {
    id: "e-1",
    occurredAt: ago(90),
    action: "auth.sign_in_failed",
    outcome: "failure",
    actor: { kind: "user", userId: null, impersonatorUserId: null },
    target: { type: "email", id: "grace@acme.test" },
    workspaceId: null,
    traceId: "0af7651916cd43dd8448eb211c80319c",
  },
];

const ACTIONS = [
  "auth.sign_in",
  "auth.sign_in_failed",
  "user.banned",
  "user.unbanned",
  "workspace.invitation_created",
];

/** The audit log in the admin portal: newest first, filters, server pages. */
const meta = {
  title: "Patterns/Admin/AuditTable",
  component: AdminAuditTable,
  tags: ["autodocs"],
  args: { events, onLoadMore: fn() },
  render: (args) => (
    <Card className="w-[960px] p-0">
      <AdminAuditTable {...args} />
    </Card>
  ),
} satisfies Meta<typeof AdminAuditTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Events, including one done while impersonating and a failure. */
export const Content: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/impersonated by u-ada/)).toBeVisible();
    await expect(canvas.getByText("Failed")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Load more" }));
    await expect(args.onLoadMore).toHaveBeenCalled();
  },
};

/** No events match. */
export const NoMatches: Story = {
  args: { events: [], onLoadMore: undefined },
};

function AuditFiltersExample() {
  const [value, setValue] = useState<AdminAuditFilters>({
    action: "user.banned",
  });
  return (
    <div className="flex w-[960px] flex-col gap-3">
      <AdminAuditFilterBar
        actions={ACTIONS}
        targetTypes={["user", "email", "workspace", "invitation"]}
        value={value}
        onValueChange={setValue}
      />
      <output aria-label="Current filters" className="text-xs text-fg-muted">
        {JSON.stringify(value)}
      </output>
    </div>
  );
}

/** Action and target filters. */
export const Filters: Story = {
  render: () => <AuditFiltersExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Current filters")).toHaveTextContent(
      "user.banned"
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Action filter" })
    );
    await expect(canvas.getByLabelText("Current filters")).toHaveTextContent(
      "{}"
    );
  },
};

function Page({ status }: { readonly status: "pending" | "error" | "empty" }) {
  return (
    <Card className="w-[960px] p-0">
      <DataState
        status={status === "empty" ? "success" : status}
        data={status === "empty" ? [] : undefined}
        error={new Error("The server didn't answer. Check your connection.")}
        onRetry={() => {}}
        isEmpty={(value: readonly AdminAuditRow[]) => value.length === 0}
        loading={<MembersTableSkeleton rows={6} />}
        empty={
          <EmptyState
            variant="compact"
            icon={<ScrollText />}
            title="No events yet"
            description="Sign-ins and changes appear here as they happen."
          />
        }
      >
        {(value) => <AdminAuditTable events={value} />}
      </DataState>
    </Card>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
/** An empty log. */
export const Empty: Story = { render: () => <Page status="empty" /> };
