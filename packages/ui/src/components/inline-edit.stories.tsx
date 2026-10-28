import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card } from "./card";
import { InlineEdit } from "./inline-edit";
import { StatusIcon } from "./issue-icons";

/**
 * Text that turns into an input on click or Enter. Enter or blur saves, Escape cancels;
 * `onValueChange` fires once per saved edit. Like renaming an issue in Linear.
 */
const meta = {
  title: "Forms/InlineEdit",
  component: InlineEdit,
  tags: ["autodocs"],
  args: {
    defaultValue: "Slow people picker in large workspaces",
    label: "Issue title",
    variant: "title",
    required: true,
    disabled: false,
    placeholder: "Issue title",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["title", "body"] },
  },
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InlineEdit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Body: Story = {
  args: {
    variant: "body",
    defaultValue: "Mobile app v3",
    label: "Project name",
  },
};

export const Empty: Story = {
  args: {
    defaultValue: "",
    required: false,
    variant: "body",
    label: "Summary",
    placeholder: "Add a one-line summary…",
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** An issue header: edit the title, the saved value and an edit count update on save. */
export const IssueHeader: Story = {
  render: function Render() {
    const [title, setTitle] = useState("Sync conflicts when editing offline");
    const [saves, setSaves] = useState(0);
    return (
      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fg-subtle text-xs">
          <StatusIcon status="in_progress" label="" />
          ENG-2131
        </div>
        <InlineEdit
          variant="title"
          label="Issue title"
          required
          maxLength={120}
          value={title}
          onValueChange={(next) => {
            setTitle(next);
            setSaves((count) => count + 1);
          }}
        />
        <InlineEdit
          label="Summary"
          placeholder="Add a summary…"
          defaultValue="Two people editing the same issue offline lose one set of changes."
        />
        <p className="text-fg-subtle text-xs">
          Saved {saves} {saves === 1 ? "time" : "times"}
        </p>
      </Card>
    );
  },
};
