import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Copy,
  FolderKanban,
  Inbox,
  Link2,
  Moon,
  Plus,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Timer,
  UserCircle,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandLoading,
  CommandPage,
  CommandPalette,
  CommandSeparator,
  useCommandPages,
  useCommandPalette,
} from "./command-palette";
import { Shortcut } from "./kbd";

/**
 * The ⌘K command palette. A search field over grouped commands with icons and shortcut
 * hints. Commands can open nested pages (“Change status…”); Backspace on an empty field
 * or Escape goes back. `useCommandPalette()` binds ⌘K / Ctrl+K; `useCommandPages()` gives
 * items `push`, `pop` and `close`.
 *
 * ```tsx
 * const { open, setOpen } = useCommandPalette();
 * <CommandPalette open={open} onOpenChange={setOpen}>
 *   <CommandPage>
 *     <CommandEmpty />
 *     <CommandGroup heading="Issues">
 *       <CommandItem icon={<Plus />} shortcut={["C"]} onSelect={...}>Create issue</CommandItem>
 *     </CommandGroup>
 *   </CommandPage>
 * </CommandPalette>
 * ```
 */
const meta = {
  title: "Overlays/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  args: {
    placeholder: "Type a command or search…",
    label: "Command palette",
    children: null,
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 620 } } },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const statuses = [
  { id: "backlog", label: "Backlog", icon: <CircleDashed />, key: "1" },
  { id: "todo", label: "Todo", icon: <CircleDot />, key: "2" },
  { id: "in-progress", label: "In Progress", icon: <Timer />, key: "3" },
  { id: "done", label: "Done", icon: <CircleCheck />, key: "4" },
  { id: "canceled", label: "Canceled", icon: <CircleX />, key: "5" },
];

const priorities = [
  { id: "urgent", label: "Urgent", icon: <SignalHigh /> },
  { id: "high", label: "High", icon: <SignalHigh /> },
  { id: "medium", label: "Medium", icon: <SignalMedium /> },
  { id: "low", label: "Low", icon: <SignalLow /> },
];

const people = [
  "Tereza Nováková",
  "Jakub Dvořák",
  "Marie Svobodová",
  "Ondřej Černý",
];

/** All pages of the issue palette. Items call `push` to go deeper and `close` when done. */
function IssueCommands({
  onRun,
}: {
  readonly onRun: (message: string) => void;
}) {
  const { push, close } = useCommandPages();
  const run = (message: string) => {
    onRun(message);
    close();
  };

  return (
    <>
      <CommandPage>
        <CommandEmpty />
        <CommandGroup heading="ENG-142">
          <CommandItem
            icon={<CircleDot />}
            shortcut={["S"]}
            onSelect={() =>
              push("status", {
                title: "Change status",
                placeholder: "Change status to…",
              })
            }
          >
            Change status…
          </CommandItem>
          <CommandItem
            icon={<UserCircle />}
            shortcut={["A"]}
            onSelect={() =>
              push("assignee", { title: "Assign", placeholder: "Assign to…" })
            }
          >
            Assign to…
          </CommandItem>
          <CommandItem
            icon={<SignalHigh />}
            shortcut={["P"]}
            onSelect={() =>
              push("priority", {
                title: "Priority",
                placeholder: "Set priority to…",
              })
            }
          >
            Set priority…
          </CommandItem>
          <CommandItem
            icon={<Link2 />}
            shortcut={["⌘", "L"]}
            onSelect={() => run("Copied link to ENG-142")}
          >
            Copy issue URL
          </CommandItem>
          <CommandItem
            icon={<Copy />}
            shortcut={["⌘", "."]}
            onSelect={() => run("Copied ENG-142")}
          >
            Copy issue ID
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Create">
          <CommandItem
            icon={<Plus />}
            shortcut={["C"]}
            onSelect={() => run("New issue")}
          >
            Create new issue
          </CommandItem>
          <CommandItem
            icon={<FolderKanban />}
            onSelect={() => run("New project")}
          >
            Create new project
          </CommandItem>
          <CommandItem
            icon={<UserPlus />}
            onSelect={() => run("Invite people")}
          >
            Invite people
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem
            icon={<Inbox />}
            shortcut={["G", "I"]}
            onSelect={() => run("Go to Inbox")}
          >
            Go to Inbox
          </CommandItem>
          <CommandItem
            icon={<ArrowRight />}
            hint="Project"
            keywords={["mobile", "ios", "android"]}
            onSelect={() => run("Opened Mobile app v2")}
          >
            Mobile app v2
          </CommandItem>
          <CommandItem
            icon={<Moon />}
            shortcut={["⌘", "⇧", "L"]}
            onSelect={() => run("Theme switched")}
          >
            Switch theme
          </CommandItem>
        </CommandGroup>
      </CommandPage>

      <CommandPage id="status">
        <CommandEmpty>No status matches</CommandEmpty>
        {statuses.map((status) => (
          <CommandItem
            key={status.id}
            icon={status.icon}
            shortcut={[status.key]}
            hint={status.id === "in-progress" ? "Current" : undefined}
            onSelect={() => run(`Status → ${status.label}`)}
          >
            {status.label}
          </CommandItem>
        ))}
      </CommandPage>

      <CommandPage id="assignee">
        <CommandEmpty>Nobody with that name</CommandEmpty>
        <CommandItem icon={<UserCircle />} onSelect={() => run("Unassigned")}>
          No assignee
        </CommandItem>
        {people.map((person) => (
          <CommandItem
            key={person}
            icon={
              <span className="flex size-4 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent">
                {person
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
            }
            onSelect={() => run(`Assigned to ${person}`)}
          >
            {person}
          </CommandItem>
        ))}
      </CommandPage>

      <CommandPage id="priority">
        {priorities.map((priority) => (
          <CommandItem
            key={priority.id}
            icon={priority.icon}
            onSelect={() => run(`Priority → ${priority.label}`)}
          >
            {priority.label}
          </CommandItem>
        ))}
      </CommandPage>
    </>
  );
}

/** Open by default: the issue palette with nested pages. Try “Change status…”. */
export const Playground: Story = {
  args: { defaultOpen: true, context: "ENG-142" },
  render: function Render(args) {
    const [last, setLast] = useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-fg-muted">
        <span>{last ? `Ran: ${last}` : "Run a command"}</span>
        <CommandPalette {...args}>
          <IssueCommands onRun={setLast} />
        </CommandPalette>
      </div>
    );
  },
};

/** Press ⌘K (or Ctrl+K) anywhere in the canvas. */
export const WithShortcut: Story = {
  render: function Render() {
    const { open, setOpen } = useCommandPalette();
    const [last, setLast] = useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-3 text-sm text-fg-muted">
        <Button
          onClick={() => setOpen(true)}
          trailing={<Shortcut keys={["⌘", "K"]} />}
        >
          Search or run a command
        </Button>
        {last ? <span>Ran: {last}</span> : null}
        <CommandPalette open={open} onOpenChange={setOpen}>
          <IssueCommands onRun={setLast} />
        </CommandPalette>
      </div>
    );
  },
};

/** Nothing matches the search. */
export const Empty: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <CommandPalette {...args}>
      <CommandPage>
        <CommandEmpty>
          No results. Try “issue”, “project” or a person’s name.
        </CommandEmpty>
      </CommandPage>
    </CommandPalette>
  ),
};

/** Async results: render CommandLoading while the request runs. */
export const Loading: Story = {
  args: { defaultOpen: true, placeholder: "Search issues…" },
  render: function Render(args) {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      const timer = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(timer);
    }, []);
    return (
      <CommandPalette {...args}>
        <CommandPage>
          {loading ? <CommandLoading /> : null}
          {loading ? null : (
            <>
              <CommandEmpty />
              <CommandGroup heading="Issues">
                <CommandItem icon={<CircleDot />} hint="ENG-142">
                  Login redirect loops when the session expires
                </CommandItem>
                <CommandItem icon={<CircleDashed />} hint="ENG-139">
                  Add rate limiting to the public API
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandPage>
      </CommandPalette>
    );
  },
};

/** Custom footer, or `footer={false}` to hide it. */
export const WithoutFooter: Story = {
  args: { defaultOpen: true, footer: false },
  render: (args) => (
    <CommandPalette {...args}>
      <CommandPage>
        <CommandGroup heading="Theme">
          <CommandItem icon={<Moon />}>Dark</CommandItem>
          <CommandItem icon={<Moon />}>Light</CommandItem>
          <CommandItem icon={<Moon />}>System</CommandItem>
        </CommandGroup>
      </CommandPage>
    </CommandPalette>
  ),
};
