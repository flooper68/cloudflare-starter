import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Copy,
  Link2,
  MoreHorizontal,
  Pencil,
  SignalHigh,
  Star,
  Trash2,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * A menu of actions opened from a button. Items take an `icon`, a `shortcut` and
 * `tone="danger"`; there are checkbox items, radio items, labels, separators and submenus.
 * Arrows move, type-ahead jumps, Enter selects, Escape closes.
 */
const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenuContent,
  tags: ["autodocs"],
  args: { align: "start", side: "bottom" },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    side: {
      control: "inline-radio",
      options: ["top", "right", "bottom", "left"],
    },
  },
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Options</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuItem icon={<Pencil />} shortcut={["E"]}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Copy />} shortcut={["⌘", "D"]}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Archive />} disabled>
          Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} tone="danger" shortcut={["⌘", "⌫"]}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const openInFrame = {
  docs: { story: { inline: false, iframeHeight: 420 } },
} as const;

export const Playground: Story = {};

export const CheckboxAndRadio: Story = {
  render: function Render() {
    const [columns, setColumns] = useState({
      id: true,
      priority: true,
      assignee: false,
    });
    const [ordering, setOrdering] = useState("priority");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Display</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Ordering</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={ordering} onValueChange={setOrdering}>
            <DropdownMenuRadioItem value="priority">
              Priority
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="updated">
              Last updated
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="created">
              Created
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Properties</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={columns.id}
            onCheckedChange={(id) => setColumns({ ...columns, id })}
          >
            ID
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={columns.priority}
            onCheckedChange={(priority) => setColumns({ ...columns, priority })}
          >
            Priority
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={columns.assignee}
            onCheckedChange={(assignee) => setColumns({ ...columns, assignee })}
          >
            Assignee
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

const statuses = [
  { value: "backlog", label: "Backlog", icon: <CircleDashed /> },
  { value: "todo", label: "Todo", icon: <CircleDot /> },
  { value: "done", label: "Done", icon: <CircleCheck /> },
];

function IssueActionsMenu({
  defaultOpen = false,
}: {
  readonly defaultOpen?: boolean;
}) {
  const [status, setStatus] = useState("todo");
  const [favorite, setFavorite] = useState(false);
  return (
    <div className="flex h-10 w-[28rem] items-center gap-3 rounded-md border border-line bg-surface-raised px-3 text-sm">
      <span className="text-xs text-fg-subtle">ENG-142</span>
      <span className="flex-1 truncate">
        Login redirect loops when the session expires
      </span>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton label="Issue actions" size="xs">
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<CircleDot />}>
              Status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={status} onValueChange={setStatus}>
                {statuses.map((item) => (
                  <DropdownMenuRadioItem key={item.value} value={item.value}>
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<UserCircle />}>
              Assignee
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Tereza Nováková</DropdownMenuItem>
              <DropdownMenuItem>Jakub Dvořák</DropdownMenuItem>
              <DropdownMenuItem>Marie Svobodová</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Unassign</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem icon={<SignalHigh />} shortcut={["P"]}>
            Set priority
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem icon={<Link2 />} shortcut={["⌘", "L"]}>
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Copy />} shortcut={["⌘", "."]}>
              Copy ID
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={favorite}
              onCheckedChange={setFavorite}
            >
              <span className="flex items-center gap-2">
                <Star className="size-4 text-fg-muted" />
                Favorite
              </span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Trash2 />}
            tone="danger"
            shortcut={["⌘", "⌫"]}
          >
            Delete issue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * An open Radix DropdownMenu (modal by default) hides the rest of the page with `aria-hidden` (so screen
 * readers stay in the popup) but leaves the trigger focusable underneath; axe reports that
 * as `aria-hidden-focus`. Radix renders that markup and offers no inert option, so the
 * rule is off for stories that render the popup open. Closed stories still check it.
 */
const radixOpenPopupA11y = {
  a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
} as const;

/** Linear's “…” menu on an issue row, open by default. */
export const IssueActions: Story = {
  parameters: { ...openInFrame, ...radixOpenPopupA11y },
  render: () => <IssueActionsMenu defaultOpen />,
};
