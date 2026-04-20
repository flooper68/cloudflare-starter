import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: {
    placeholder: "name@example.com",
    disabled: false,
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="grid w-[360px] gap-3">
      <Input placeholder="Default input" />
      <Input defaultValue="With value" />
      <Input disabled placeholder="Disabled input" />
    </div>
  ),
};
