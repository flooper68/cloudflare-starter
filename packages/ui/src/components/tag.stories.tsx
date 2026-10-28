import type { Meta, StoryObj } from "@storybook/react-vite";
import { Hash } from "lucide-react";
import { useState } from "react";
import type { Tone } from "./badge";
import { Tag } from "./tag";

/**
 * Tags (chips) show labels on an issue, active filters or chosen values. The colour dot
 * mirrors Linear labels. Add `onRemove` for a × button (Backspace on it removes too).
 */
const meta = {
  title: "Data display/Tag",
  component: Tag,
  tags: ["autodocs"],
  args: { children: "Bug", color: "danger", size: "md" },
  argTypes: {
    color: {
      control: "select",
      options: ["neutral", "accent", "success", "warning", "danger", "info"],
    },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Labels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-1.5">
      <Tag color="danger">Bug</Tag>
      <Tag color="accent">Feature</Tag>
      <Tag color="info">Improvement</Tag>
      <Tag color="warning">Performance</Tag>
      <Tag color="success">Design</Tag>
      <Tag color="neutral">Tech debt</Tag>
      <Tag icon={<Hash />}>frontend</Tag>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tag size="sm" color="accent">
        Feature
      </Tag>
      <Tag size="md" color="accent">
        Feature
      </Tag>
    </div>
  ),
};

const initialFilters: Array<{ label: string; color: Tone }> = [
  { label: "Status: In Progress", color: "warning" },
  { label: "Assignee: Ada Lovelace", color: "accent" },
  { label: "Label: Bug", color: "danger" },
];

export const Removable: Story = {
  render: () => {
    const [filters, setFilters] = useState(initialFilters);
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => (
          <Tag
            key={filter.label}
            color={filter.color}
            onRemove={() =>
              setFilters((all) => all.filter((f) => f.label !== filter.label))
            }
          >
            {filter.label}
          </Tag>
        ))}
        {filters.length === 0 ? (
          <button
            type="button"
            className="text-xs text-fg-muted hover:text-fg"
            onClick={() => setFilters(initialFilters)}
          >
            Reset filters
          </button>
        ) : null}
      </div>
    );
  },
};

export const Truncated: Story = {
  render: () => (
    <div className="w-48">
      <Tag color="info">Customer request: enterprise SSO via Okta</Tag>
    </div>
  ),
};
