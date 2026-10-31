import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BackupCodes } from "./backup-codes";

const meta = {
  title: "Patterns/Security/BackupCodes",
  component: BackupCodes,
  tags: ["autodocs"],
  args: { codes: ["demo-first-code", "demo-second-code"], onDone: fn() },
} satisfies Meta<typeof BackupCodes>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const ConfirmSaved: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "I saved my recovery codes",
      })
    );
    await expect(args.onDone).toHaveBeenCalled();
  },
};
