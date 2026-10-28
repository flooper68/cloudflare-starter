import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "./button";
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonListRow,
  SkeletonText,
} from "./skeleton";

/**
 * Placeholders that keep the layout steady while content loads. Match the shape of the
 * real content; prefer presets (`SkeletonText`, `SkeletonAvatar`, `SkeletonCard`,
 * `SkeletonListRow`) and size a bare `Skeleton` with classes for anything else. Mark
 * the loading region with `aria-busy`.
 */
const meta = {
  title: "Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Text: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-6">
      <SkeletonText lines={1} />
      <SkeletonText lines={3} />
      <SkeletonText lines={5} />
    </div>
  ),
};

export const Avatars: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <SkeletonAvatar size="xs" />
      <SkeletonAvatar size="sm" />
      <SkeletonAvatar size="md" />
      <SkeletonAvatar size="lg" />
      <SkeletonAvatar size="xl" />
    </div>
  ),
};

export const Card: Story = {
  render: () => <SkeletonCard className="w-80" />,
};

export const ListRows: Story = {
  render: () => (
    <div className="w-[30rem] rounded-lg border border-line bg-surface-raised">
      {Array.from({ length: 5 }, (_, index) => (
        <SkeletonListRow
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className="border-b border-line last:border-b-0"
        />
      ))}
    </div>
  ),
};

const issues = [
  {
    id: "ENG-142",
    title: "Login redirect loops when the session expires",
    who: "TN",
  },
  { id: "ENG-139", title: "Add rate limiting to the public API", who: "JD" },
  {
    id: "ENG-131",
    title: "Dark mode: chart tooltips are unreadable",
    who: "MS",
  },
];

/** An issue list that loads for a second, then shows the rows. */
export const LoadingThenLoaded: Story = {
  render: function Render() {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      if (!loading) return;
      const timer = setTimeout(() => setLoading(false), 1200);
      return () => clearTimeout(timer);
    }, [loading]);
    return (
      <div className="flex w-[30rem] flex-col gap-3">
        <div
          aria-busy={loading}
          className="rounded-lg border border-line bg-surface-raised"
        >
          {loading
            ? issues.map((issue) => (
                <SkeletonListRow
                  key={issue.id}
                  className="border-b border-line last:border-b-0"
                />
              ))
            : issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0"
                >
                  <span className="size-3.5 shrink-0 rounded-full border-2 border-fg-subtle" />
                  <span className="w-14 shrink-0 text-xs text-fg-subtle">
                    {issue.id}
                  </span>
                  <span className="flex-1 truncate">{issue.title}</span>
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent-text">
                    {issue.who}
                  </span>
                </div>
              ))}
        </div>
        <Button
          size="sm"
          className="self-start"
          onClick={() => setLoading(true)}
        >
          Reload
        </Button>
      </div>
    );
  },
};
