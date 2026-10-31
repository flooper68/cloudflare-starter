import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { OneTimeCodeInput } from "./one-time-code-input";

const meta = {
  title: "Forms/OneTimeCodeInput",
  component: OneTimeCodeInput,
  args: { onValueChange: () => {} },
  tags: ["autodocs"],
} satisfies Meta<typeof OneTimeCodeInput>;
export default meta;
type Story = StoryObj<typeof meta>;
function Controlled() {
  const [code, setCode] = useState("");
  return <OneTimeCodeInput value={code} onValueChange={setCode} />;
}
export const Playground: Story = { render: () => <Controlled /> };
export const TypeCode: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Verification code",
    });
    await userEvent.type(input, "12a3456");
    await expect(input).toHaveValue("123456");
  },
};
export const Disabled: Story = {
  args: { value: "123456", disabled: true, onValueChange: () => {} },
};
export const Recovery: Story = {
  args: { value: "test-recovery", recovery: true, onValueChange: () => {} },
};
