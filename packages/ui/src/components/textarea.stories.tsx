import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { Field } from "./field";
import { Textarea } from "./textarea";

/**
 * Multi-line text. `autoGrow` fits the height to the content (capped by `maxRows`),
 * `showCount` adds a counter that warns near `maxLength`.
 */
const meta = {
  title: "Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Add a description…",
    autoGrow: false,
    showCount: false,
    disabled: false,
    rows: 3,
  },
  argTypes: {
    maxLength: { control: "number" },
    maxRows: { control: "number" },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AutoGrow: Story = {
  args: {
    autoGrow: true,
    rows: 2,
    maxRows: 8,
    defaultValue:
      "When a workspace has more than 500 members, the people picker takes several seconds to open.\nType a few lines to see the field grow.",
  },
};

export const CharacterCount: Story = {
  args: {
    showCount: true,
    maxLength: 140,
    defaultValue: "Shipped the new onboarding checklist to 20% of workspaces.",
  },
};

export const NearTheLimit: Story = {
  args: {
    showCount: true,
    maxLength: 60,
    defaultValue: "Refactor the sync engine so offline edits merge cleanly",
  },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <Textarea disabled defaultValue="Archived projects cannot be edited." />
      </Field>
      <Field label="Read only">
        <Textarea readOnly defaultValue="Imported from GitHub issue #4182." />
      </Field>
      <Field
        label="Release notes"
        error="Release notes are required to publish"
      >
        <Textarea placeholder="What changed in this release?" />
      </Field>
    </div>
  ),
};

export const InAComment: Story = {
  render: function Render() {
    const [comment, setComment] = useState("");
    return (
      <Card>
        <CardHeader>
          <CardTitle>ENG-2148 Slow people picker in large workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Leave a comment" description="Markdown is supported.">
            <Textarea
              autoGrow
              rows={2}
              maxRows={10}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Leave a comment…"
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="primary" size="sm" disabled={!comment.trim()}>
            Comment
          </Button>
        </CardFooter>
      </Card>
    );
  },
};
