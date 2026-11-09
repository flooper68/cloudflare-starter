import type { Meta, StoryObj } from "@storybook/react-vite";
import { Boxes } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { EmptyState } from "../empty-state";
import {
  ContainerRunList,
  ContainerRunListSkeleton,
  ContainerRunStatusBadge,
  type ContainerRunStepView,
  ContainerRunTimeline,
  type ContainerRunView,
  formatRunDuration,
} from "./container-run";

const NOW = Date.parse("2026-11-08T12:00:10.000Z");
const at = (seconds: number) =>
  new Date(NOW - 10_000 + seconds * 1000).toISOString();

const names = [
  "queued",
  "starting",
  "computing",
  "storing",
  "notifying",
  "done",
] as const;

/** A timeline with the first `finished` steps done, then `current` in its state. */
function steps(
  finished: number,
  current: ContainerRunStepView["status"] = "running"
): ContainerRunStepView[] {
  return names.map((name, index) => {
    if (index < finished) {
      return {
        name,
        status: "done",
        startedAt: at(index * 1.4),
        finishedAt: at((index + 1) * 1.4),
      };
    }
    if (index === finished) {
      return {
        name,
        status: current,
        startedAt: current === "pending" ? null : at(index * 1.4),
        finishedAt: current === "failed" ? at(index * 1.4 + 2) : null,
      };
    }
    return {
      name,
      status: current === "failed" ? "skipped" : "pending",
      startedAt: null,
      finishedAt: null,
    };
  });
}

const runs: ContainerRunView[] = [
  {
    id: "r1",
    digits: 50_000,
    status: "running",
    steps: steps(2),
    createdAt: at(0),
    durationMs: null,
    startedBy: "Grace Hopper",
  },
  {
    id: "r2",
    digits: 10_000,
    status: "failed",
    steps: steps(1, "failed"),
    createdAt: at(-3600),
    durationMs: 3400,
    error: "The container did not start",
    startedBy: "Ada Lovelace",
  },
  {
    id: "r3",
    digits: 1000,
    status: "succeeded",
    steps: steps(6),
    createdAt: at(-7200),
    durationMs: 8400,
    startedBy: "Ada Lovelace",
  },
];

/**
 * The container workflow demo (Developer demos): the live step timeline of one run and
 * the workspace's past runs with Retry on failed ones. The app polls the run every
 * second while it is queued or running.
 */
const meta = {
  title: "Patterns/Containers/ContainerRunTimeline",
  component: ContainerRunTimeline,
  tags: ["autodocs"],
  args: { steps: steps(2), now: NOW },
} satisfies Meta<typeof ContainerRunTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Running: queued and starting done, computing for the last few seconds. */
export const Running: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(6);
    await expect(items[2]).toHaveAttribute("data-status", "running");
    await expect(items[2]).toHaveTextContent("Computing");
    await expect(items[0]).toHaveTextContent("1.4 s");
    await expect(
      canvas.getByRole("list", { name: "Run steps" })
    ).toHaveAttribute("aria-live", "polite");
  },
};

/** Queued: accepted, the workflow has not started yet. */
export const Queued: Story = { args: { steps: steps(0) } };

/** Succeeded: every step done, with its time. */
export const Succeeded: Story = {
  args: { steps: steps(6) },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    for (const item of items)
      await expect(item).toHaveAttribute("data-status", "done");
  },
};

/** Failed: the container did not start; the later steps are skipped. */
export const Failed: Story = {
  args: { steps: steps(1, "failed") },
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");
    await expect(items[1]).toHaveAttribute("data-status", "failed");
    await expect(items[5]).toHaveAttribute("data-status", "skipped");
  },
};

/** The status badges. */
export const StatusBadges: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["queued", "running", "succeeded", "failed"] as const).map((status) => (
        <ContainerRunStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

/** Past runs: open one, retry a failed one. */
export const PastRuns: Story = {
  render: () => (
    <ContainerRunList
      runs={runs}
      selectedId="r1"
      onOpen={fn()}
      onRetry={fn()}
    />
  ),
};

const openRun = fn();
const retryRun = fn();

/** Retry calls back with the failed run's id; the row's main button opens it. */
export const RetryAndOpen: Story = {
  render: () => (
    <ContainerRunList runs={runs} onOpen={openRun} onRetry={retryRun} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const retries = canvas.getAllByRole("button", { name: /^Retry/ });
    await expect(retries).toHaveLength(1);
    const [retry] = retries;
    if (retry) await userEvent.click(retry);
    await expect(retryRun).toHaveBeenCalledWith("r2");
    await userEvent.click(canvas.getByRole("button", { name: /1,000 digits/ }));
    await expect(openRun).toHaveBeenCalledWith("r3");
  },
};

/** While a limit is reached, Retry is off. */
export const RetryDisabled: Story = {
  render: () => (
    <ContainerRunList runs={runs} onOpen={fn()} onRetry={fn()} retryDisabled />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /^Retry/ })
    ).toBeDisabled();
  },
};

/** Loading: rows shaped like runs. */
export const Loading: Story = {
  render: () => <ContainerRunListSkeleton />,
};

/** Empty: no run yet in this workspace. */
export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<Boxes />}
      title="No runs yet"
      description="Pick how many digits of pi to compute and start a run."
    />
  ),
};

/** Durations read as milliseconds, seconds or minutes. */
export const Durations: Story = {
  render: () => (
    <ul className="text-sm text-fg">
      {[820, 4200, 65_000].map((ms) => (
        <li key={ms}>{formatRunDuration(ms)}</li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent("820 ms4.2 s1 min 5 s");
  },
};
