import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TotpSetup } from "./totp-setup";

const meta = {
  title: "Patterns/Security/TotpSetup",
  component: TotpSetup,
  tags: ["autodocs"],
  args: {
    qrUrl:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='192' height='192'><rect width='192' height='192' fill='white'/></svg>",
    secret: "EXAMPLE-SETUP-KEY",
    code: "123456",
    onCode: fn(),
    onVerify: fn(),
  },
} satisfies Meta<typeof TotpSetup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Verify: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Verify and enable" })
    );
    await expect(args.onVerify).toHaveBeenCalled();
  },
};
export const Loading: Story = { args: { pending: true } };
export const Failed: Story = {
  args: { error: "The code did not match. Try the next code." },
};
