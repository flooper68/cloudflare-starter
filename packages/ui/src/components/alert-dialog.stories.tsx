import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  ConfirmDialog,
  useConfirm,
} from "./alert-dialog";
import { Button } from "./button";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

/**
 * A modal that requires an answer: it does not close on outside click, and focus starts on
 * Cancel. Use it only for destructive or irreversible actions. `useConfirm()` gives a
 * promise-based `confirm()` for the common case; `ConfirmDialog` is the same thing as a
 * controlled component.
 */
const meta = {
  title: "Overlays/AlertDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  args: {
    open: false,
    title: "Delete project?",
    description:
      "“Mobile app v2” and its 48 issues will be deleted for everyone. This can’t be undone.",
    confirmLabel: "Delete project",
    cancelLabel: "Cancel",
    tone: "danger",
    onOpenChange: () => {},
    onConfirm: () => {},
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["default", "danger"] },
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const openInFrame = {
  docs: { story: { inline: false, iframeHeight: 360 } },
} as const;

export const Playground: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button
          variant="danger"
          icon={<Trash2 />}
          onClick={() => setOpen(true)}
        >
          Delete project
        </Button>
        <ConfirmDialog
          {...args}
          open={open}
          onOpenChange={setOpen}
          onConfirm={args.onConfirm}
        />
      </>
    );
  },
};

/** Open by default, for the docs page. */
export const Open: Story = {
  parameters: openInFrame,
  args: { open: true },
};

/** Non-destructive confirmation with the primary button. */
export const DefaultTone: Story = {
  parameters: openInFrame,
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button icon={<Archive />}>Archive cycle</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="pr-5">
          <AlertDialogTitle>Archive Cycle 42?</AlertDialogTitle>
          <AlertDialogDescription>
            7 unfinished issues will move to Cycle 43.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/** `useConfirm()` in a settings card: `await confirm({...})` resolves to true or false. */
export const UseConfirmHook: Story = {
  render: function Render() {
    const { confirm, dialog } = useConfirm();
    const [result, setResult] = useState<string>("Nothing deleted yet.");
    return (
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting the project removes its issues, documents and updates.
          </CardDescription>
        </CardHeader>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">{result}</span>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 />}
            onClick={async () => {
              const ok = await confirm({
                title: "Delete project?",
                description:
                  "“Mobile app v2” and its 48 issues will be deleted. This can’t be undone.",
                confirmLabel: "Delete project",
                tone: "danger",
              });
              setResult(ok ? "Project deleted." : "Kept the project.");
            }}
          >
            Delete project
          </Button>
        </div>
        {dialog}
      </Card>
    );
  },
};
