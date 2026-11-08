import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotebookPen, Plus } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "../button";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { UpgradePrompt } from "../upgrade-prompt";
import { NoteList, type NoteListItem, NoteListSkeleton } from "./note-list";
import { PlaceholderNotice } from "./placeholder-notice";

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const notes: NoteListItem[] = [
  {
    id: "n1",
    title: "Q3 launch checklist",
    excerpt: "Freeze the pricing page",
    author: "Grace Hopper",
    updatedAt: hoursAgo(2),
    commentCount: 1,
  },
  {
    id: "n2",
    title: "Interview notes · Babbage and Co",
    excerpt: "They want SSO before the pilot",
    author: "Ada Lovelace",
    updatedAt: hoursAgo(26),
    commentCount: 0,
  },
  {
    id: "n3",
    title: "Pricing page copy",
    excerpt: "",
    author: null,
    updatedAt: hoursAgo(80),
    commentCount: 3,
  },
];

/**
 * The placeholder Notes app's list: the workspace's notes, most recently changed first.
 * The other stories are its four data states, as the app wires them through DataState,
 * and the limit-reached prompt where the plan's `notes` limit stops someone.
 */
const meta = {
  title: "Patterns/Notes/NoteList",
  component: NoteList,
  tags: ["autodocs"],
  args: { notes, onOpen: fn() },
} satisfies Meta<typeof NoteList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Content: three notes, one by a deleted account. */
export const Content: Story = {};

/** Enter on a focused row opens the note. */
export const KeyboardOpen: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole("option");
    rows[1]?.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("n2");
    await expect(rows[2]).toHaveTextContent("3 comments");
  },
};

/** Loading: rows shaped like the notes. */
export const Loading: Story = {
  render: () => <NoteListSkeleton />,
};

/** Empty: why, and the next step. */
export const Empty: Story = {
  render: () => (
    <DataState
      status="success"
      data={{ items: [] as NoteListItem[] }}
      loading={<NoteListSkeleton />}
      empty={
        <EmptyState
          icon={<NotebookPen />}
          title="No notes yet"
          description="Notes you and your workspace write show up here."
          primaryAction={
            <Button variant="primary" icon={<Plus />}>
              New note
            </Button>
          }
        />
      }
    >
      {(data) => <NoteList notes={data.items} onOpen={() => {}} />}
    </DataState>
  ),
};

/** Error: a safe message, the reference to quote, and Try again. */
export const LoadFailed: Story = {
  render: () => (
    <DataState
      status="error"
      data={undefined}
      error={Object.assign(new Error("Internal error"), {
        data: { reference: "4bf92f3577b34da6a3ce929d0e0e4736" },
      })}
      onRetry={() => {}}
      loading={<NoteListSkeleton />}
      empty={null}
    >
      {() => null}
    </DataState>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Try again" })
    ).toBeVisible();
  },
};

/** Limit reached: the upgrade prompt where creating stops, above the notes. */
export const LimitReached: Story = {
  render: (args) => (
    <div className="space-y-4">
      <PlaceholderNotice />
      <UpgradePrompt
        reason={{ kind: "limit", subject: "notes", limit: "50" }}
        mode="provider"
        canUpgrade
        options={[{ id: "plan:pro", label: "Upgrade to Pro" }]}
        onUpgrade={() => {}}
      />
      <NoteList {...args} />
    </div>
  ),
};
