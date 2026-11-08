import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { PlaceholderNotice } from "./placeholder-notice";

/** Marks a placeholder app (Notes, Tasks) as an example of where a product's feature goes. */
const meta = {
  title: "Patterns/PlaceholderNotice",
  component: PlaceholderNotice,
  tags: ["autodocs"],
} satisfies Meta<typeof PlaceholderNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default text. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("complementary", {
        name: "Placeholder app",
      })
    ).toHaveTextContent("Placeholder · your product goes here");
  },
};

/** A module without a backend says so. */
export const SampleData: Story = {
  args: {
    children:
      "Sample tasks in your browser only: nothing is saved. It shows IssueList, KanbanBoard and FilterBar from the component library.",
  },
};
