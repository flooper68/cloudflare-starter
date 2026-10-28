import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard } from "lucide-react";
import { expect, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminOverview,
  type AdminOverviewData,
  AdminOverviewSkeleton,
} from "./admin-overview";

const series = (values: readonly number[]) =>
  values.map((count, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    count,
  }));

const data: AdminOverviewData = {
  users: { total: 1284, admins: 3, banned: 7 },
  signUps: series([
    12, 9, 14, 18, 11, 7, 6, 15, 21, 19, 17, 13, 8, 9, 22, 25, 24, 18, 14, 10,
    9, 27, 31, 26, 20, 16, 12, 29, 33, 30,
  ]),
  activeUsers: series([
    210, 198, 230, 244, 251, 120, 118, 260, 271, 268, 259, 240, 132, 128, 280,
    291, 302, 288, 270, 140, 136, 310, 322, 318, 305, 290, 150, 330, 341, 337,
  ]),
  workspaces: {
    total: 1490,
    shared: 412,
    personal: 1078,
    sizes: [
      { label: "1 member", count: 96 },
      { label: "2–5 members", count: 231 },
      { label: "6–20 members", count: 74 },
      { label: "21+ members", count: 11 },
    ],
  },
};

/**
 * The admin portal's overview, from D1: users, sign-ups and active users over 30 days,
 * and workspace counts and sizes. The page wraps it in `DataState`.
 */
const meta = {
  title: "Patterns/Admin/Overview",
  component: AdminOverview,
  tags: ["autodocs"],
  args: { data },
  render: (args) => (
    <div className="w-[960px]">
      <AdminOverview {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A busy app. */
export const Content: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1,284")).toBeVisible();
    await expect(canvas.getByText("3 / 7")).toBeVisible();
    await expect(canvas.getByText("2–5 members")).toBeVisible();
  },
};

/** With billing on: workspaces per plan and status, trials and this month's usage. */
export const WithBilling: Story = {
  args: {
    data: {
      ...data,
      plans: {
        plans: [
          {
            planId: "pro",
            planName: "Pro",
            status: "trialing",
            workspaces: 214,
          },
          { planId: "pro", planName: "Pro", status: "active", workspaces: 131 },
          { planId: "free", planName: "Free", status: null, workspaces: 1145 },
        ],
        trials: { active: 214, endingSoon: 37 },
      },
      usage: {
        period: "2026-10",
        metrics: [
          { metric: "files.uploads_per_month", unit: "count", total: 18_422 },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("214 trials, 37 ending within 7 days")
    ).toBeVisible();
    await expect(canvas.getByText("18,422")).toBeVisible();
  },
};

/** Personal mode: no workspace section. */
export const PersonalMode: Story = {
  args: { data: { ...data, workspaces: null } },
};

/** A new app: zeros everywhere. */
export const NewApp: Story = {
  args: {
    data: {
      users: { total: 1, admins: 1, banned: 0 },
      signUps: series(Array.from({ length: 30 }, () => 0)),
      activeUsers: series(Array.from({ length: 30 }, () => 0)),
      workspaces: {
        total: 1,
        shared: 0,
        personal: 1,
        sizes: [
          { label: "1 member", count: 0 },
          { label: "2–5 members", count: 0 },
          { label: "6–20 members", count: 0 },
          { label: "21+ members", count: 0 },
        ],
      },
    },
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[960px]">
      <DataState
        status={status}
        data={undefined as AdminOverviewData | undefined}
        error={new Error("The server didn't answer. Check your connection.")}
        onRetry={() => {}}
        loading={<AdminOverviewSkeleton />}
        empty={
          <EmptyState icon={<LayoutDashboard />} title="Nothing to show yet" />
        }
      >
        {(value) => <AdminOverview data={value} />}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };

/** Failed to load, with retry. */
export const ErrorStateStory: Story = {
  name: "Error",
  render: () => <Page status="error" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /try again/i })
    ).toBeVisible();
  },
};
