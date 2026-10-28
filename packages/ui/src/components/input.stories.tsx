import type { Meta, StoryObj } from "@storybook/react-vite";
import { AtSign, Search } from "lucide-react";

import { Input } from "./input";
import { Kbd } from "./kbd";

/**
 * Single-line text field. Use inside `Field` for a label, help text and errors; on its
 * own it needs an `aria-label` (a placeholder is not a label).
 */
const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Issue title", size: "md", disabled: false },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md", "lg"] } },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};

export const WithAdornments: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Search issues"
        leading={<Search />}
        trailing={<Kbd>/</Kbd>}
        placeholder="Search issues"
      />
      <Input
        aria-label="Username"
        leading={<AtSign />}
        placeholder="username"
      />
      <Input
        aria-label="Estimate"
        trailing={<span className="text-xs">hours</span>}
        defaultValue="4"
      />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Input aria-label="Title" defaultValue="Fix login redirect loop" />
      <Input aria-label="Email" aria-invalid defaultValue="no-reply@" />
      <Input aria-label="Due date" disabled placeholder="Disabled" />
      <Input aria-label="Issue ID" readOnly defaultValue="ENG-1284" />
    </div>
  ),
};
