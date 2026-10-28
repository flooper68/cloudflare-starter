import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./field";
import { Input } from "./input";

/**
 * Label, control, help text and error wired together: the control gets an id,
 * `aria-describedby` and `aria-invalid` automatically.
 */
const meta = {
  title: "Forms/Field",
  component: Field,
  tags: ["autodocs"],
  args: {
    label: "Workspace URL",
    description: "Lowercase letters, numbers and dashes.",
    error: "",
    optional: false,
    children: <Input placeholder="acme" />,
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithError: Story = {
  args: {
    error: "This URL is already taken.",
    children: <Input defaultValue="acme" />,
  },
};

export const Optional: Story = {
  args: { label: "Display name", optional: true, description: undefined },
};
