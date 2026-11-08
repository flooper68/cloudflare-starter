import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Card } from "../card";
import { NoteEditor } from "./note-editor";

/** The form that writes or edits a note in the placeholder Notes app. */
const meta = {
  title: "Patterns/Notes/NoteEditor",
  component: NoteEditor,
  tags: ["autodocs"],
  args: { onSave: fn(async () => {}), onCancel: fn() },
  render: (args) => (
    <Card className="max-w-xl">
      <NoteEditor {...args} />
    </Card>
  ),
} satisfies Meta<typeof NoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A new note. */
export const NewNote: Story = { args: { submitLabel: "Create note" } };

/** Editing an existing note. */
export const Editing: Story = {
  args: {
    defaultValue: {
      title: "Q3 launch checklist",
      body: "Freeze the pricing page\nRun the restore drill on the D1 backup",
    },
  },
};

/** Saving sends the trimmed title and the body. */
export const SaveSends: Story = {
  args: { submitLabel: "Create note" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Title"), "  Support macros ");
    await userEvent.type(canvas.getByLabelText(/Note/), "Refunds");
    await userEvent.click(canvas.getByRole("button", { name: "Create note" }));
    await expect(args.onSave).toHaveBeenCalledWith({
      title: "Support macros",
      body: "Refunds",
    });
  },
};

/** A blank title is refused before anything is sent. */
export const TitleRequired: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByText("A note needs a title")).toBeVisible();
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

/** A failed save keeps the draft and says why (here, the plan's limit). */
export const SaveFails: Story = {
  args: {
    defaultValue: { title: "One too many", body: "" },
    onSave: fn(async () => {
      throw new Error("The free plan allows 50 notes");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "allows 50 notes"
    );
    await expect(canvas.getByLabelText("Title")).toHaveValue("One too many");
  },
};
