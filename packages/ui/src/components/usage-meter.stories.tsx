import type { Meta, StoryObj } from "@storybook/react-vite";
import { Gauge } from "lucide-react";
import { expect, within } from "storybook/test";

import { Card } from "./card";
import { DataState } from "./data-state";
import { EmptyState } from "./empty-state";
import {
  formatBytes,
  UsageMeter,
  UsageMeterSkeleton,
  usageLevel,
} from "./usage-meter";

const MB = 1024 * 1024;

/**
 * Usage of one plan limit: "used of limit", a bar that turns amber near the limit and red
 * at or past it, and a badge naming the state. Unlimited metrics show only what is used.
 */
const meta = {
  title: "Data display/UsageMeter",
  component: UsageMeter,
  tags: ["autodocs"],
  args: { label: "Storage", unit: "bytes", used: 38 * MB, limit: 100 * MB },
  decorators: [
    (Story) => (
      <Card className="w-[28rem]">
        <Story />
      </Card>
    ),
  ],
} satisfies Meta<typeof UsageMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Well under the limit: accent bar, no badge. */
export const UnderLimit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("38 MB of 100 MB")).toBeVisible();
    await expect(
      canvas.getByRole("progressbar", { name: "Storage used" })
    ).toHaveAttribute("aria-valuenow", "38");
    await expect(canvas.queryByText("Near limit")).toBeNull();
  },
};

/** From 80% of the limit: amber, "Near limit". */
export const NearLimit: Story = {
  args: { label: "Seats", unit: "count", used: 21, limit: 25 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Near limit")).toBeVisible();
    await expect(canvas.getByText("21 of 25")).toBeVisible();
  },
};

/** At the limit: red, "Limit reached". */
export const LimitReached: Story = {
  args: { used: 100 * MB },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Limit reached")
    ).toBeVisible();
  },
};

/** Past the limit (an admin lowered it): the bar stays full, "Over limit". */
export const OverLimit: Story = {
  args: {
    label: "Uploads this month",
    unit: "count",
    used: 140,
    limit: 100,
    description: "Resets on 1 December (UTC).",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Over limit")).toBeVisible();
    await expect(
      canvas.getByRole("progressbar", { name: "Uploads this month used" })
    ).toHaveAttribute("aria-valuenow", "100");
  },
};

/** No limit: what is used and "Unlimited", no bar. */
export const Unlimited: Story = {
  args: { limit: null, used: 3.4 * 1024 * MB },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Unlimited")).toBeVisible();
    await expect(canvas.getByText("3.4 GB used")).toBeVisible();
    await expect(canvas.queryByRole("progressbar")).toBeNull();
  },
};

/** The levels and byte formatting the meter uses, as pure functions. */
export const Levels: Story = {
  play: async () => {
    await expect(usageLevel(10, 100)).toBe("ok");
    await expect(usageLevel(80, 100)).toBe("near");
    await expect(usageLevel(100, 100)).toBe("full");
    await expect(usageLevel(101, 100)).toBe("over");
    await expect(usageLevel(0, 0)).toBe("full");
    await expect(usageLevel(5, null)).toBe("unlimited");
    await expect(formatBytes(1536)).toBe("1.5 KB");
    await expect(formatBytes(10 * 1024 * MB)).toBe("10 GB");
  },
};

/** Every metric of a plan, as on the billing page. */
export const PlanUsage: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <UsageMeter
        label="Storage"
        unit="bytes"
        used={82 * MB}
        limit={100 * MB}
      />
      <UsageMeter
        label="Uploads this month"
        used={12}
        limit={100}
        description="Resets on 1 December (UTC)."
      />
      <UsageMeter label="Seats" used={3} limit={3} />
    </div>
  ),
};

function Loading({ status }: { readonly status: "pending" | "error" }) {
  return (
    <DataState
      status={status}
      data={undefined as number | undefined}
      error={new Error("Couldn't load usage")}
      onRetry={() => {}}
      loading={<UsageMeterSkeleton />}
      empty={
        <EmptyState variant="compact" icon={<Gauge />} title="No limits" />
      }
    >
      {() => null}
    </DataState>
  );
}

/** Loading. */
export const Skeleton: Story = { render: () => <Loading status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Loading status="error" /> };
