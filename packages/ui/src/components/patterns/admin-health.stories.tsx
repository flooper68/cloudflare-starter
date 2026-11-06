import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeartPulse } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import {
  AdminHealth,
  type AdminHealthCheck,
  type AdminHealthData,
  AdminHealthSkeleton,
} from "./admin-health";

const TIME = "2026-11-06T10:00:00.000Z";
const pass = (
  componentType: string,
  observedValue?: number
): AdminHealthCheck[] => [
  {
    componentType,
    status: "pass",
    time: TIME,
    ...(observedValue === undefined
      ? {}
      : { observedValue, observedUnit: "ms" }),
  },
];

const healthy: AdminHealthData = {
  status: "pass",
  releaseId: "3f2c1d7e-8a41-4b7e-9f3a-5d0c2e6b9a17",
  reference: "4bf92f3577b34da6a3ce929d0e0e4736",
  checks: {
    "d1:responseTime": pass("datastore", 4),
    "r2:responseTime": pass("datastore", 18),
    "queue:binding": pass("component"),
    "email:configuration": pass("component"),
    "settings:configuration": pass("system"),
    "rate-limits:bindings": pass("component"),
    "analytics-engine:bindings": pass("component"),
  },
};

/**
 * The deployment's readiness on the admin overview: the same checks as `/health/ready`,
 * run live when the page opens, with each failure's detail.
 */
const meta = {
  title: "Patterns/Admin/Health",
  component: AdminHealth,
  tags: ["autodocs"],
  args: { health: healthy, onRefresh: fn() },
  render: (args) => (
    <div className="w-[720px]">
      <AdminHealth {...args} />
    </div>
  ),
} satisfies Meta<typeof AdminHealth>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every check passes. */
export const Pass: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Pass")).toHaveLength(8);
    await expect(canvas.getByText("18 ms")).toBeVisible();
  },
};

/** Up, with a concern: mail is not configured and R2 answered slowly. */
export const Warn: Story = {
  args: {
    health: {
      ...healthy,
      status: "warn",
      output: "2 of 7 checks warned",
      checks: {
        ...healthy.checks,
        "r2:responseTime": [
          {
            componentType: "datastore",
            status: "warn",
            time: TIME,
            observedValue: 1340,
            observedUnit: "ms",
            output: "slow: took 1340 ms (warns above 1000 ms)",
          },
        ],
        "email:configuration": [
          {
            componentType: "component",
            status: "warn",
            time: TIME,
            output:
              "not configured: the EMAIL send_email binding or EMAIL_FROM is missing",
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2 of 7 checks warned")).toBeVisible();
    await expect(canvas.getAllByText("Warn")).toHaveLength(3);
  },
};

/** Down: D1 does not answer, so readiness answers 503. */
export const Fail: Story = {
  args: {
    health: {
      ...healthy,
      status: "fail",
      output: "1 of 7 checks failed",
      checks: {
        ...healthy.checks,
        "d1:responseTime": [
          {
            componentType: "datastore",
            status: "fail",
            time: TIME,
            observedValue: 2000,
            observedUnit: "ms",
            output: "timeout: no answer within 2000 ms",
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("timeout: no answer within 2000 ms")
    ).toBeVisible();
    await expect(canvas.getAllByText("Fail")).toHaveLength(2);
  },
};

/** "Check again" runs the checks again; the button spins meanwhile. */
export const CheckAgain: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Check again" })
    );
    await expect(args.onRefresh).toHaveBeenCalledOnce();
  },
};

/** While the checks run again. */
export const Refreshing: Story = { args: { refreshing: true } };

function Page({ status }: { readonly status: "pending" | "error" }) {
  return (
    <div className="w-[720px]">
      <DataState
        status={status}
        data={undefined as AdminHealthData | undefined}
        error={new Error("The server didn't answer. Check your connection.")}
        onRetry={() => {}}
        loading={<AdminHealthSkeleton />}
        empty={<EmptyState icon={<HeartPulse />} title="No checks ran" />}
      >
        {(value) => <AdminHealth health={value} />}
      </DataState>
    </div>
  );
}

/** Loading. */
export const Loading: Story = { render: () => <Page status="pending" /> };

/** The checks could not be run, with retry. */
export const ErrorStateStory: Story = {
  name: "Error",
  render: () => <Page status="error" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /try again/i })
    ).toBeVisible();
  },
};
