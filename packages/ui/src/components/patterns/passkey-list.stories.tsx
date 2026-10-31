import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PasskeyList } from "./passkey-list";

const meta = {
  title: "Patterns/Security/PasskeyList",
  component: PasskeyList,
  tags: ["autodocs"],
  args: {
    items: [{ id: "personal", name: "Personal laptop" }],
    onAdd: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof PasskeyList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Empty: Story = { args: { items: [] } };
export const Loading: Story = { args: { pending: true } };
export const AddAndRemove: Story = {
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Add passkey" }));
    await expect(args.onAdd).toHaveBeenCalled();
    await userEvent.click(
      c.getByRole("button", { name: "Remove Personal laptop" })
    );
    await expect(args.onRemove).toHaveBeenCalledWith("personal");
  },
};
