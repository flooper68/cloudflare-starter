import type { Meta, StoryObj } from "@storybook/react-vite";
import { Flag } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { SkeletonCard } from "../skeleton";
import { type AdminFlag, AdminFlagCard } from "./admin-flag-card";

const flag: AdminFlag = {
  key: "upload-demo-presigned",
  description:
    "Shows the presigned (browser to R2) upload card next to the Worker upload on the upload demo page.",
  type: "boolean",
  default: true,
  owner: "platform",
  removeWhen: "the upload demo keeps a single upload path",
  stored: {
    enabled: true,
    fallthrough: null,
    rules: [{ kind: "percentage", percentageBp: 2500, value: true }],
    updatedAt: "2026-10-27T09:30:00.000Z",
  },
};

/** A feature flag on the admin Flags page: switch and targeting rules. */
const meta = {
  title: "Patterns/Admin/FlagCard",
  component: AdminFlagCard,
  tags: ["autodocs"],
  args: {
    definition: flag,
    onToggle: fn(async () => {}),
    onSaveRules: fn(async () => {}),
  },
  render: (args) => (
    <div className="w-[880px]">
      <AdminFlagCard {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminFlagCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A flag rolled out to a quarter of workspaces. */
export const Content: Story = {};

/** Never configured: off, no rules. */
export const NotConfigured: Story = {
  args: { definition: { ...flag, stored: null } },
};

/** Stored data that does not parse. */
export const Invalid: Story = {
  args: {
    definition: {
      ...flag,
      stored: {
        invalid: true,
        error: "rules[0].percentageBp must be at most 10000",
      },
    },
  },
};

/** The switch reports the new state. */
export const Toggle: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("switch", { name: /Enabled/ })
    );
    await waitFor(() => expect(args.onToggle).toHaveBeenCalledWith(false));
  },
};

function Page({ status }: { readonly status: "pending" | "error" | "empty" }) {
  return (
    <div className="w-[880px]">
      <DataState
        status={status === "empty" ? "success" : status}
        data={
          (status === "empty" ? [] : undefined) as
            | readonly AdminFlag[]
            | undefined
        }
        error={new Error("Feature flags are not stored in this environment")}
        onRetry={() => {}}
        isEmpty={(value: readonly AdminFlag[]) => value.length === 0}
        loading={<SkeletonCard />}
        empty={
          <EmptyState
            icon={<Flag />}
            title="No feature flags"
            description="Add one to the catalog in packages/features/src/feature-flags."
          />
        }
      >
        {(flags) =>
          flags.map((item) => (
            <AdminFlagCard
              key={item.key}
              definition={item}
              onToggle={async () => {}}
              onSaveRules={async () => {}}
            />
          ))
        }
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load (no flag store). */
export const Failed: Story = { render: () => <Page status="error" /> };
/** An empty catalog. */
export const Empty: Story = { render: () => <Page status="empty" /> };
