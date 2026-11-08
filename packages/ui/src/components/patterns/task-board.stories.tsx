import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import type { Issue, IssuePerson } from "./issue-glyphs";
import { TaskBoard } from "./task-board";

const ada: IssuePerson = { id: "ada", name: "Ada Lovelace" };
const grace: IssuePerson = { id: "grace", name: "Grace Hopper" };

const tasks: Issue[] = [
  {
    id: "t1",
    identifier: "ACM-41",
    title: "Import contacts from CSV",
    status: "backlog",
    priority: "low",
    assignee: null,
  },
  {
    id: "t2",
    identifier: "ACM-44",
    title: "Invite flow copy review",
    status: "todo",
    priority: "medium",
    assignee: ada,
  },
  {
    id: "t3",
    identifier: "ACM-39",
    title: "Passkey rename",
    status: "in_progress",
    priority: "medium",
    assignee: grace,
  },
  {
    id: "t4",
    identifier: "ACM-35",
    title: "Workspace logo upload",
    status: "done",
    priority: "high",
    assignee: grace,
  },
];

/**
 * The placeholder Tasks app: sample tasks as a board or a list, filtered by status,
 * priority and assignee. Nothing is saved.
 */
const meta = {
  title: "Patterns/TaskBoard",
  component: TaskBoard,
  tags: ["autodocs"],
  args: { tasks, people: [ada, grace] },
  parameters: { layout: "padded" },
} satisfies Meta<typeof TaskBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The board: one column per status. */
export const Board: Story = {};

/** The list, grouped by status. */
export const ListView: Story = { args: { defaultView: "list" } };

/** The view switch changes how the same tasks render. */
export const SwitchToList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4 of 4 tasks")).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "List" }));
    await expect(canvas.getByRole("grid", { name: "Tasks" })).toBeVisible();
  },
};
