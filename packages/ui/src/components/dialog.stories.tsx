import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDashed, Paperclip, SignalHigh, UserCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Field } from "./field";
import { Input } from "./input";
import { Shortcut } from "./kbd";

/**
 * A modal for focused tasks: create an issue, rename a project, invite people. Focus is
 * trapped inside; Escape or a click on the backdrop closes it. Sizes `sm` to `xl` and
 * `full`. Compose `DialogHeader`, `DialogBody` (scrolls when tall) and `DialogFooter`
 * (actions right-aligned). For destructive confirmations use AlertDialog.
 */
const meta = {
  title: "Overlays/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  args: { size: "md", showClose: true },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg", "xl", "full"],
    },
  },
  render: (args) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Rename project</Button>
      </DialogTrigger>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Everyone in the Engineering team will see the new name.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Name">
            <Input defaultValue="Mobile app v2" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="primary">Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders inside its own frame in the docs, so the open modal does not cover the page. */
const openInFrame = {
  docs: { story: { inline: false, iframeHeight: 560 } },
} as const;

export const Playground: Story = {};

/**
 * Interaction test: the trigger opens the modal with focus inside, Tab cycles within it
 * (focus trap), Escape closes it and focus returns to the trigger.
 */
export const FocusTrapAndEscape: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Rename project" });

    await step("Opening moves focus into the dialog", async () => {
      await userEvent.click(trigger);
      const dialog = await page.findByRole("dialog", {
        name: "Rename project",
      });
      await waitFor(() =>
        expect(dialog).toContainElement(document.activeElement as HTMLElement)
      );
    });

    await step("Tab and Shift+Tab stay inside the dialog", async () => {
      const dialog = page.getByRole("dialog");
      for (let i = 0; i < 6; i++) {
        await userEvent.tab();
        await expect(dialog).toContainElement(
          document.activeElement as HTMLElement
        );
      }
      for (let i = 0; i < 6; i++) {
        await userEvent.tab({ shift: true });
        await expect(dialog).toContainElement(
          document.activeElement as HTMLElement
        );
      }
    });

    await step("Escape closes and returns focus to the trigger", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
      await expect(trigger).toHaveFocus();
    });
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["sm", "md", "lg", "xl", "full"] as const).map((size) => (
        <Dialog key={size}>
          <DialogTrigger asChild>
            <Button>{size}</Button>
          </DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Size “{size}”</DialogTitle>
              <DialogDescription>
                The width adapts; the height follows the content up to the
                viewport.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="text-fg-muted">
                Use sm for confirmations, md for small forms, lg and xl for
                richer editors, full for views like a document preview.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
};

const changelog = [
  "Sub-issues now inherit the parent's project and cycle.",
  "Triage: accept or decline issues with 1 and 2.",
  "Projects show a progress ring based on completed scope.",
  "GitHub: pull requests link to issues by branch name.",
  "Slack: notifications for status changes in followed projects.",
  "Command palette: “Change status…” works on selections.",
  "Cycles: unfinished issues roll over automatically.",
  "Views: filter by label groups and by estimate.",
  "Inbox: snooze until a date or until the next cycle.",
  "API: webhooks for project updates.",
  "Search: results ranked by recent activity.",
  "Templates: default assignee per team.",
];

/** A long body scrolls between the fixed header and footer. */
export const ScrollingBody: Story = {
  parameters: openInFrame,
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>What’s new</Button>
      </DialogTrigger>
      <DialogContent size="md" className="h-[420px]">
        <DialogHeader>
          <DialogTitle>What’s new in October</DialogTitle>
          <DialogDescription>
            12 improvements since your last visit.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="flex flex-col gap-3">
            {changelog.map((entry) => (
              <li key={entry} className="rounded-md border border-line p-3">
                {entry}
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter separated>
          <DialogClose asChild>
            <Button variant="primary">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

function PropertyChip({
  icon,
  children,
}: {
  readonly icon: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <Button size="xs" icon={icon}>
      {children}
    </Button>
  );
}

function CreateIssueDialog({
  defaultOpen = false,
}: {
  readonly defaultOpen?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const error =
    submitted && title.trim() === "" ? "Give the issue a title" : null;

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" trailing={<Shortcut keys={["C"]} />}>
          New issue
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span className="rounded-sm bg-hover px-1.5 py-0.5 font-medium">
                ENG
              </span>
              <span>›</span>
              <span>New issue</span>
            </div>
            <DialogTitle className="sr-only">Create issue</DialogTitle>
            <DialogDescription className="sr-only">
              Create an issue in the Engineering team.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Title" error={error}>
              <Input
                placeholder="Issue title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Description" optional>
              <Input placeholder="Add a description…" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              <PropertyChip icon={<CircleDashed />}>Backlog</PropertyChip>
              <PropertyChip icon={<SignalHigh />}>Priority</PropertyChip>
              <PropertyChip icon={<UserCircle />}>Assignee</PropertyChip>
            </div>
          </DialogBody>
          <DialogFooter separated>
            <Button
              variant="ghost"
              size="sm"
              icon={<Paperclip />}
              className="mr-auto"
            >
              Attach
            </Button>
            <DialogClose asChild>
              <Button size="sm">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" size="sm">
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Linear's “Create issue” modal: breadcrumb, fields, property chips, footer actions. */
export const CreateIssue: Story = {
  parameters: openInFrame,
  render: () => <CreateIssueDialog defaultOpen />,
};

export const WithoutCloseButton: Story = {
  args: { showClose: false },
};
