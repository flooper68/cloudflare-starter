import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Card } from "./card";
import { Progress, ProgressRing } from "./progress";

/**
 * `Progress` is a thin bar: determinate with `value`, looping without it (unknown
 * length). `ProgressRing` is the small circle Linear shows next to projects and cycles,
 * optionally with the percentage; it turns green at 100%.
 */
const meta = {
  title: "Feedback/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    value: 42,
    size: "md",
    tone: "accent",
    label: "Uploading attachments",
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    tone: {
      control: "inline-radio",
      options: ["accent", "success", "warning", "danger"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress size="sm" value={30} label="Small" />
      <Progress size="md" value={55} label="Medium" />
      <Progress size="lg" value={80} label="Large" />
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress tone="accent" value={40} label="Accent" />
      <Progress tone="success" value={100} label="Success" />
      <Progress tone="warning" value={85} label="Warning" />
      <Progress tone="danger" value={97} label="Danger" />
    </div>
  ),
};

export const Indeterminate: Story = {
  args: { value: null, label: "Importing issues" },
};

/** Fills over time, like a file upload. */
export const Animated: Story = {
  render: function Render() {
    const [value, setValue] = useState(0);
    useEffect(() => {
      const timer = setInterval(
        () => setValue((current) => (current >= 100 ? 0 : current + 7)),
        400
      );
      return () => clearInterval(timer);
    }, []);
    return (
      <div className="flex flex-col gap-2 text-xs text-fg-muted">
        <div className="flex justify-between">
          <span>design-review.fig</span>
          <span className="tabular-nums">{Math.min(value, 100)}%</span>
        </div>
        <Progress
          value={Math.min(value, 100)}
          label="Uploading design-review.fig"
        />
      </div>
    );
  },
};

export const Rings: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <ProgressRing value={0} label="Not started" />
      <ProgressRing value={25} label="25%" />
      <ProgressRing value={64} showValue label="64%" />
      <ProgressRing value={100} showValue label="Done" />
      <ProgressRing value={42} size="sm" showValue label="Small" />
      <ProgressRing value={72} size="lg" showValue label="Large" />
      <ProgressRing
        value={90}
        tone="warning"
        size="lg"
        showValue
        label="At risk"
      />
    </div>
  ),
};

const projects = [
  {
    name: "Mobile app v2",
    lead: "Jakub Dvořák",
    progress: 64,
    target: "Dec 12",
  },
  {
    name: "Billing migration",
    lead: "Marie Svobodová",
    progress: 100,
    target: "Oct 20",
  },
  {
    name: "Public API rate limits",
    lead: "Tereza Nováková",
    progress: 18,
    target: "Jan 15",
  },
];

/** Project list with progress rings, like Linear's Projects view. */
export const ProjectList: Story = {
  decorators: [
    (Story) => (
      <div className="w-[32rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Card className="p-0">
      {projects.map((project) => (
        <div
          key={project.name}
          className="flex h-11 items-center gap-3 border-b border-line px-4 text-sm last:border-b-0"
        >
          <span className="flex-1 truncate font-medium">{project.name}</span>
          <span className="w-32 truncate text-xs text-fg-muted">
            {project.lead}
          </span>
          <span className="w-14 text-xs text-fg-subtle">{project.target}</span>
          <ProgressRing
            value={project.progress}
            showValue
            label={`${project.name} progress`}
            className="w-14"
          />
        </div>
      ))}
    </Card>
  ),
};
