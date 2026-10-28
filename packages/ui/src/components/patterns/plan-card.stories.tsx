import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditCard } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "../button";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { PlanCard, PlanCardSkeleton } from "./plan-card";

const proLimits = [
  { label: "Storage", value: "10 GB" },
  { label: "Uploads per month", value: "10,000" },
  { label: "Seats", value: "25" },
];

/**
 * The workspace's plan on the billing page: its name and state (active, a trial with the
 * days left, payment overdue, canceled), its key limits, what it includes, and actions.
 */
const meta = {
  title: "Patterns/Billing/PlanCard",
  component: PlanCard,
  tags: ["autodocs"],
  args: {
    planName: "Pro",
    status: "active",
    limits: proLimits,
    includes: ["Direct uploads"],
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A paid plan with the owner's actions. */
export const ActiveWithActions: Story = {
  args: {
    description: "Renews on 1 December.",
    actions: (
      <>
        <Button size="sm" onClick={fn()}>
          Manage billing
        </Button>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Active")).toBeVisible();
    await expect(canvas.getByText("10 GB")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Manage billing" })
    );
  },
};

/** A trial with more than a week left: informational. */
export const Trialing: Story = {
  args: { status: "trialing", trialDaysLeft: 12 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Trial · 12 days left")
    ).toBeVisible();
  },
};

/** A trial ending within 7 days: a warning. */
export const TrialEndingSoon: Story = {
  args: { status: "trialing", trialDaysLeft: 1 },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Trial · 1 day left")
    ).toBeVisible();
  },
};

/** The free plan, after a trial ended. */
export const Free: Story = {
  args: {
    planName: "Free",
    limits: [
      { label: "Storage", value: "100 MB" },
      { label: "Uploads per month", value: "100" },
      { label: "Seats", value: "3" },
    ],
    includes: [],
    description: "Assigned by your admin.",
  },
};

/** Payment overdue. */
export const PastDue: Story = { args: { status: "past_due" } };

/** Canceled; keeps its plan until the period ends. */
export const Canceled: Story = {
  args: { status: "canceled", description: "Access until 30 November." },
};

/** No subscription (the default plan): no badge. */
export const NoSubscription: Story = {
  args: { planName: "Free", status: null, includes: [] },
};

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <DataState
      status={status}
      data={undefined as string | undefined}
      error={new Error("Couldn't load the plan")}
      onRetry={() => {}}
      loading={<PlanCardSkeleton />}
      empty={<EmptyState icon={<CreditCard />} title="No plan" />}
    >
      {() => null}
    </DataState>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };
/** Failed to load. */
export const Failed: Story = { render: () => <Page status="error" /> };
