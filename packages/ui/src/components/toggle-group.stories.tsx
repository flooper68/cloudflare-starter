import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  Link,
  Strikethrough,
} from "lucide-react";
import { Separator } from "./separator";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

/**
 * Toggle buttons in a row. `type="multiple"` for independent toggles (text formatting),
 * `type="single"` for at most one (alignment). Icon-only items need `label`.
 */
const meta = {
  title: "Forms/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  args: {
    type: "multiple",
    size: "md",
    disabled: false,
    "aria-label": "Formatting",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
  render: (args) => (
    <ToggleGroup
      type="multiple"
      size={args.size}
      disabled={args.disabled}
      aria-label={args["aria-label"]}
      defaultValue={["bold"]}
    >
      <ToggleGroupItem value="bold" icon={<Bold />} label="Bold" />
      <ToggleGroupItem value="italic" icon={<Italic />} label="Italic" />
      <ToggleGroupItem
        value="strike"
        icon={<Strikethrough />}
        label="Strikethrough"
      />
      <ToggleGroupItem value="code" icon={<Code />} label="Inline code" />
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

export const Single: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="left" aria-label="Alignment">
      <ToggleGroupItem value="left" icon={<AlignLeft />} label="Align left" />
      <ToggleGroupItem
        value="center"
        icon={<AlignCenter />}
        label="Align center"
      />
      <ToggleGroupItem
        value="right"
        icon={<AlignRight />}
        label="Align right"
      />
    </ToggleGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <ToggleGroup
      type="multiple"
      defaultValue={["mine"]}
      aria-label="Quick filters"
    >
      <ToggleGroupItem value="mine">Assigned to me</ToggleGroupItem>
      <ToggleGroupItem value="created">Created by me</ToggleGroupItem>
      <ToggleGroupItem value="subscribed">Subscribed</ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <ToggleGroup
      type="multiple"
      defaultValue={["bold"]}
      disabled
      aria-label="Formatting"
    >
      <ToggleGroupItem value="bold" icon={<Bold />} label="Bold" />
      <ToggleGroupItem value="italic" icon={<Italic />} label="Italic" />
    </ToggleGroup>
  ),
};

/** A comment editor toolbar. */
export const EditorToolbar: Story = {
  render: () => (
    <div className="w-[420px] rounded-lg border border-line bg-surface-raised">
      <div className="flex items-center gap-1 border-line border-b px-1.5 py-1">
        <ToggleGroup type="multiple" size="sm" aria-label="Formatting">
          <ToggleGroupItem value="bold" icon={<Bold />} label="Bold" />
          <ToggleGroupItem value="italic" icon={<Italic />} label="Italic" />
          <ToggleGroupItem
            value="strike"
            icon={<Strikethrough />}
            label="Strikethrough"
          />
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToggleGroup type="multiple" size="sm" aria-label="Insert">
          <ToggleGroupItem value="code" icon={<Code />} label="Inline code" />
          <ToggleGroupItem value="link" icon={<Link />} label="Link" />
        </ToggleGroup>
      </div>
      <p className="px-3 py-3 text-fg-subtle text-sm">Leave a comment…</p>
    </div>
  ),
};
