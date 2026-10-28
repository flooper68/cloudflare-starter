import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Archive,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Copy,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";

/**
 * A right-click menu (long-press on touch). Rows look exactly like DropdownMenu rows:
 * `icon`, `shortcut`, `tone="danger"`, checkbox and radio items, submenus. Always offer the
 * same actions elsewhere too (a "…" button), since right-click is not discoverable.
 */
const meta = {
  title: "Overlays/ContextMenu",
  component: ContextMenuContent,
  tags: ["autodocs"],
  render: (args) => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-80 items-center justify-center rounded-lg border border-dashed border-line-strong text-sm text-fg-muted">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent {...args}>
        <ContextMenuItem icon={<Pencil />} shortcut={["E"]}>
          Edit
        </ContextMenuItem>
        <ContextMenuItem icon={<Copy />} shortcut={["⌘", "D"]}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem icon={<Archive />} disabled>
          Archive
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem icon={<Trash2 />} tone="danger">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
} satisfies Meta<typeof ContextMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const issues = [
  { id: "ENG-142", title: "Login redirect loops when the session expires" },
  { id: "ENG-139", title: "Add rate limiting to the public API" },
  { id: "ENG-131", title: "Dark mode: chart tooltips are unreadable" },
];

/** Right-click any issue row. */
export const IssueList: Story = {
  render: function Render() {
    const [status, setStatus] = useState("todo");
    const [subscribed, setSubscribed] = useState(true);
    return (
      <div className="w-[30rem] overflow-hidden rounded-lg border border-line bg-surface-raised">
        {issues.map((issue) => (
          <ContextMenu key={issue.id}>
            <ContextMenuTrigger className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0 data-[state=open]:bg-hover">
              <span className="w-14 text-xs text-fg-subtle">{issue.id}</span>
              <span className="truncate">{issue.title}</span>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-60">
              <ContextMenuLabel>{issue.id}</ContextMenuLabel>
              <ContextMenuSub>
                <ContextMenuSubTrigger icon={<CircleDot />}>
                  Status
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuRadioGroup
                    value={status}
                    onValueChange={setStatus}
                  >
                    <ContextMenuRadioItem value="backlog">
                      <span className="flex items-center gap-2">
                        <CircleDashed className="size-4 text-fg-muted" />
                        Backlog
                      </span>
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem value="todo">
                      <span className="flex items-center gap-2">
                        <CircleDot className="size-4 text-fg-muted" />
                        Todo
                      </span>
                    </ContextMenuRadioItem>
                    <ContextMenuRadioItem value="done">
                      <span className="flex items-center gap-2">
                        <CircleCheck className="size-4 text-fg-muted" />
                        Done
                      </span>
                    </ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem icon={<Link2 />} shortcut={["⌘", "L"]}>
                Copy link
              </ContextMenuItem>
              <ContextMenuCheckboxItem
                checked={subscribed}
                onCheckedChange={setSubscribed}
              >
                Subscribed
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                icon={<Trash2 />}
                tone="danger"
                shortcut={["⌘", "⌫"]}
              >
                Delete issue
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    );
  },
};
