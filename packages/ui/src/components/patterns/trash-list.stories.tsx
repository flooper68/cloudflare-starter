import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2 } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Card } from "../card";
import { DataState } from "../data-state";
import { EmptyState } from "../empty-state";
import { TrashList, type TrashListItem, TrashListSkeleton } from "./trash-list";

const NOW = new Date("2026-10-28T12:00:00.000Z");

const items: TrashListItem[] = [
  {
    type: "file",
    id: "f-roadmap",
    label: "Q4 roadmap.pdf",
    sizeBytes: 482_113,
    deletedAt: "2026-10-27T16:20:00.000Z",
    deletedByName: "Grace Hopper",
    purgeAt: "2026-11-26T16:20:00.000Z",
  },
  {
    type: "file",
    id: "f-invoice",
    label: "Invoice 2026-031.pdf",
    sizeBytes: 91_204,
    deletedAt: "2026-10-12T09:05:00.000Z",
    deletedByName: "Ada Lovelace",
    purgeAt: "2026-11-11T09:05:00.000Z",
  },
  {
    type: "file",
    id: "f-notes",
    label: "standup-notes.txt",
    sizeBytes: 812,
    deletedAt: "2026-09-29T12:30:00.000Z",
    deletedByName: null,
    purgeAt: "2026-10-29T12:30:00.000Z",
  },
];

/**
 * A workspace's trash: deleted items with who deleted them and how long until they are
 * deleted for good. Members restore; owners also delete permanently and empty the trash,
 * both after a confirmation. The page wraps it in `DataState`.
 */
const meta = {
  title: "Patterns/TrashList",
  component: TrashList,
  tags: ["autodocs"],
  args: {
    items,
    canRestore: true,
    canPurge: true,
    now: NOW,
    onRestore: fn(),
    onDeletePermanently: fn(),
    onEmpty: fn(),
  },
  render: (args) => (
    <Card className="w-[860px]">
      <TrashList {...args} />
    </Card>
  ),
} satisfies Meta<typeof TrashList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What an owner sees: restore, delete permanently, empty trash. */
export const OwnerView: Story = {};

/** What a member sees: restore only. */
export const MemberView: Story = {
  args: { canPurge: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Restore Q4 roadmap.pdf" })
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /Delete permanently/ })
    ).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Empty trash" })
    ).toBeNull();
  },
};

/** "Restore" reports the item at once: nothing is lost, so no confirmation. */
export const RestoreItem: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Restore Invoice 2026-031.pdf" })
    );
    await expect(args.onRestore).toHaveBeenCalledWith(items[1]);
  },
};

/** "Delete permanently" asks first; cancel does nothing, confirm reports the item. */
export const ConfirmDeletePermanently: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = () =>
      canvas.getByRole("button", {
        name: "Delete permanently Q4 roadmap.pdf",
      });

    await userEvent.click(trigger());
    let dialog = await page.findByRole("alertdialog", {
      name: "Delete Q4 roadmap.pdf permanently?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" })
    );
    await waitFor(() => expect(page.queryByRole("alertdialog")).toBeNull());
    await expect(args.onDeletePermanently).not.toHaveBeenCalled();

    await userEvent.click(trigger());
    dialog = await page.findByRole("alertdialog", {
      name: "Delete Q4 roadmap.pdf permanently?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete permanently" })
    );
    await expect(args.onDeletePermanently).toHaveBeenCalledWith(items[0]);
    await waitFor(() => expect(page.queryByRole("alertdialog")).toBeNull());
  },
};

/** "Empty trash" names how many items go, and reports after the confirmation. */
export const EmptyTrash: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Empty trash" }));
    const dialog = await page.findByRole("alertdialog", {
      name: "Empty trash?",
    });
    await expect(dialog).toHaveTextContent("3 items are deleted for good");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Empty trash" })
    );
    await expect(args.onEmpty).toHaveBeenCalledOnce();
  },
};

type PageStatus = "pending" | "error" | "empty" | "success";

/** The trash page body: heading, then the four data states. */
function TrashPage({
  status,
  canPurge = true,
}: {
  readonly status: PageStatus;
  readonly canPurge?: boolean;
}) {
  const data =
    status === "success"
      ? { items }
      : status === "empty"
        ? { items: [] }
        : undefined;
  return (
    <div className="flex w-[880px] flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-fg">Trash</h2>
        <p className="text-sm text-fg-muted">
          Deleted files stay here for 30 days, then they are deleted for good.
        </p>
      </div>
      <Card>
        <DataState
          status={status === "empty" ? "success" : status}
          data={data}
          error={new Error("The server didn't answer. Check your connection.")}
          onRetry={() => {}}
          loading={<TrashListSkeleton />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Trash2 />}
              title="Trash is empty"
              description="Files you delete stay here for 30 days before they are deleted for good."
            />
          }
        >
          {(value) => (
            <TrashList
              items={value.items}
              canRestore
              canPurge={canPurge}
              now={NOW}
            />
          )}
        </DataState>
      </Card>
    </div>
  );
}

/** Trash page: loading. */
export const PageLoading: Story = {
  render: () => <TrashPage status="pending" />,
};

/** Trash page: failed to load, with retry. */
export const PageError: Story = {
  render: () => <TrashPage status="error" />,
};

/** Trash page: nothing in the trash. */
export const PageEmpty: Story = {
  render: () => <TrashPage status="empty" />,
};

/** Trash page as an owner. */
export const PageOwner: Story = {
  render: () => <TrashPage status="success" />,
};

/** Trash page as a member: no permanent delete, no empty. */
export const PageMember: Story = {
  render: () => <TrashPage status="success" canPurge={false} />,
};
