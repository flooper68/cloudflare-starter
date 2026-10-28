import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditCard } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  type AdminBillingCatalog,
  type AdminBillingData,
  AdminBillingPanel,
  AdminBillingPanelSkeleton,
} from "./admin-billing-panel";

const MB = 1024 * 1024;

const catalog: AdminBillingCatalog = {
  plans: [
    { id: "free", name: "Free" },
    { id: "pro", name: "Pro" },
    { id: "unlimited", name: "Unlimited" },
  ],
  addons: [
    { id: "extra_storage", name: "Extra 10 GB" },
    { id: "extra_seats", name: "5 more seats" },
  ],
  features: [{ key: "files.presigned_upload", label: "Direct uploads" }],
  metrics: [
    { key: "storage_bytes", label: "Storage", unit: "bytes" },
    {
      key: "files.uploads_per_month",
      label: "Uploads this month",
      unit: "count",
    },
    { key: "seats", label: "Seats", unit: "count" },
  ],
};

const data: AdminBillingData = {
  mode: "manual",
  planId: "free",
  status: "active",
  trialEndsAt: null,
  addons: [{ addonId: "extra_seats", quantity: 1 }],
  overrides: [{ key: "storage_bytes", kind: "limit", limit: 0 }],
  features: [],
  usage: [
    { metric: "storage_bytes", used: 2 * MB, limit: 0 },
    { metric: "files.uploads_per_month", used: 14, limit: 100 },
    { metric: "seats", used: 7, limit: 8 },
  ],
};

const actions = {
  onAssignPlan: fn(async () => true),
  onSetAddons: fn(async () => true),
  onSetOverride: fn(async () => true),
};

/**
 * A workspace's billing in the admin portal: plan and state, usage against limits
 * (overridden limits marked), and forms to assign a plan, set add-ons and set or remove
 * an override with a reason.
 */
const meta = {
  title: "Patterns/Admin/BillingPanel",
  component: AdminBillingPanel,
  tags: ["autodocs"],
  args: { data, catalog, ...actions },
  decorators: [
    (Story) => (
      <div className="w-[880px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminBillingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Manual billing: a workspace over its overridden storage limit. */
export const Manual: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Manual billing")).toBeVisible();
    await expect(canvas.getByText("Over limit")).toBeVisible();
    await expect(canvas.getByText("Override")).toBeVisible();
    await expect(canvas.getByText("5 more seats × 1")).toBeVisible();
  },
};

/** Raise the storage limit with a reason: the limit is sent in bytes. */
export const RaiseStorageLimit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const form = within(canvas.getByRole("form", { name: "Override" }));
    await userEvent.click(form.getByRole("button", { name: "Set override" }));
    await expect(
      form.getByText("Say why, in at least 3 characters")
    ).toBeVisible();
    await expect(
      form.getByText("Enter a limit, or tick Unlimited")
    ).toBeVisible();
    await userEvent.type(form.getByLabelText("Limit (MB)"), "50");
    await userEvent.type(form.getByLabelText("Reason"), "Pilot customer");
    await userEvent.click(form.getByRole("button", { name: "Set override" }));
    await waitFor(() =>
      expect(args.onSetOverride).toHaveBeenCalledWith({
        key: "storage_bytes",
        reason: "Pilot customer",
        override: { kind: "limit", limit: 50 * MB },
      })
    );
  },
};

/** Remove an override (it needs a reason too). */
export const RemoveOverride: Story = {
  play: async ({ args, canvasElement }) => {
    const form = within(
      within(canvasElement).getByRole("form", { name: "Override" })
    );
    await userEvent.type(form.getByLabelText("Reason"), "Pilot ended");
    await userEvent.click(
      form.getByRole("button", { name: "Remove override" })
    );
    await waitFor(() =>
      expect(args.onSetOverride).toHaveBeenCalledWith({
        key: "storage_bytes",
        reason: "Pilot ended",
        override: null,
      })
    );
  },
};

/** Put the workspace on a trial: the end date is required. */
export const AssignTrial: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const form = within(
      within(canvasElement).getByRole("form", { name: "Assign plan" })
    );
    await userEvent.click(form.getByRole("combobox", { name: "Plan" }));
    await userEvent.click(await page.findByRole("option", { name: "Pro" }));
    await userEvent.click(
      await form.findByRole("combobox", { name: "Status" })
    );
    await userEvent.click(await page.findByRole("option", { name: "Trial" }));
    await userEvent.click(
      await form.findByRole("button", { name: "Assign plan" })
    );
    await expect(form.getByText("Pick the day the trial ends")).toBeVisible();
    await userEvent.type(form.getByLabelText("Trial ends (UTC)"), "2026-12-01");
    await userEvent.click(form.getByRole("button", { name: "Assign plan" }));
    await waitFor(() =>
      expect(args.onAssignPlan).toHaveBeenCalledWith({
        planId: "pro",
        status: "trialing",
        trialEndsAt: "2026-12-01T00:00:00.000Z",
      })
    );
  },
};

/** Set add-on quantities; zero removes one. */
export const SetAddons: Story = {
  play: async ({ args, canvasElement }) => {
    const form = within(
      within(canvasElement).getByRole("form", { name: "Add-ons" })
    );
    const storage = form.getByLabelText("Extra 10 GB");
    await userEvent.clear(storage);
    await userEvent.type(storage, "2");
    const seats = form.getByLabelText("5 more seats");
    await userEvent.clear(seats);
    await userEvent.type(seats, "0");
    await userEvent.click(form.getByRole("button", { name: "Save add-ons" }));
    await waitFor(() =>
      expect(args.onSetAddons).toHaveBeenCalledWith([
        { addonId: "extra_storage", quantity: 2 },
      ])
    );
  },
};

/** Provider billing: a trialing workspace; the provider's next event wins. */
export const Provider: Story = {
  args: {
    data: {
      ...data,
      mode: "provider",
      planId: "pro",
      status: "trialing",
      trialEndsAt: "2026-11-02T00:00:00.000Z",
      addons: [],
      overrides: [],
      features: ["files.presigned_upload"],
      usage: [
        {
          metric: "storage_bytes",
          used: 1.2 * 1024 * MB,
          limit: 10 * 1024 * MB,
        },
        { metric: "files.uploads_per_month", used: 8_200, limit: 10_000 },
        { metric: "seats", used: 4, limit: 25 },
      ],
    },
    trialDaysLeft: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("The billing provider owns this subscription")
    ).toBeVisible();
    await expect(canvas.getByText("Trial · 5 days left")).toBeVisible();
    await expect(canvas.getByText("No overrides.")).toBeVisible();
  },
};

/** BILLING=off: nothing to administer. */
export const BillingOff: Story = {
  args: { data: { ...data, mode: "off" } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Billing is off")
    ).toBeVisible();
  },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <DataState
      status={status}
      data={undefined as AdminBillingData | undefined}
      error={new Error("Couldn't load billing")}
      onRetry={() => {}}
      loading={<AdminBillingPanelSkeleton />}
      empty={<EmptyState icon={<CreditCard />} title="No billing" />}
    >
      {(value) => (
        <AdminBillingPanel data={value} catalog={catalog} {...actions} />
      )}
    </DataState>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
