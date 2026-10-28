import type { Meta, StoryObj } from "@storybook/react-vite";
import { AtSign, Search } from "lucide-react";

import { Input } from "./input";
import { Kbd } from "./kbd";

/** Single-line text field. Use inside `Field` for a label, help text and errors. */
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
        leading={<Search />}
        trailing={<Kbd>/</Kbd>}
        placeholder="Search issues"
      />
      <Input leading={<AtSign />} placeholder="username" />
      <Input
        trailing={<span className="text-xs">hours</span>}
        defaultValue="4"
      />
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Input defaultValue="Fix login redirect loop" />
      <Input aria-invalid defaultValue="no-reply@" />
      <Input disabled placeholder="Disabled" />
      <Input readOnly defaultValue="ENG-1284" />
    </div>
  ),
};
