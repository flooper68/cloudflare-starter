import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CalendarDays,
  CircleDot,
  Link2,
  SignalHigh,
  Tag,
  UserCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

/**
 * A side panel for details that keep the list underneath in context: an issue, a person,
 * filters. Slides in from the `right` (default), `left` or `bottom`; sizes `sm` to `xl`.
 */
const meta = {
  title: "Overlays/Sheet",
  component: SheetContent,
  tags: ["autodocs"],
  args: { side: "right", size: "md", showClose: true },
  argTypes: {
    side: { control: "inline-radio", options: ["right", "left", "bottom"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] },
  },
  render: (args) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open filters</Button>
      </SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow down the issues in this view.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="text-fg-muted">
          Status, assignee, label and project filters go here.
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="ghost">Reset</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button variant="primary">Apply</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const openInFrame = {
  docs: { story: { inline: false, iframeHeight: 600 } },
} as const;

export const Playground: Story = {};

export const Sides: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["right", "left", "bottom"] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button>From {side}</Button>
          </SheetTrigger>
          <SheetContent side={side} size="sm">
            <SheetHeader>
              <SheetTitle>From the {side}</SheetTitle>
            </SheetHeader>
            <SheetBody className="text-fg-muted">Panel content.</SheetBody>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["sm", "md", "lg", "xl"] as const).map((size) => (
        <Sheet key={size}>
          <SheetTrigger asChild>
            <Button>{size}</Button>
          </SheetTrigger>
          <SheetContent size={size}>
            <SheetHeader>
              <SheetTitle>Size “{size}”</SheetTitle>
            </SheetHeader>
            <SheetBody className="text-fg-muted">Panel content.</SheetBody>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

function Property({
  icon,
  label,
  children,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex h-8 items-center gap-3">
      <span className="flex w-24 items-center gap-2 text-xs text-fg-subtle [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-sm text-fg">{children}</span>
    </div>
  );
}

/** Issue details pane, open by default. */
export const IssueDetail: Story = {
  parameters: openInFrame,
  render: () => (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button>ENG-142</Button>
      </SheetTrigger>
      <SheetContent size="lg">
        <SheetHeader>
          <span className="text-xs text-fg-subtle">ENG-142</span>
          <SheetTitle>
            Login redirect loops when the session cookie expires
          </SheetTitle>
          <SheetDescription className="sr-only">Issue details</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <div className="flex flex-col">
            <Property icon={<CircleDot />} label="Status">
              In Progress
            </Property>
            <Property icon={<SignalHigh />} label="Priority">
              High
            </Property>
            <Property icon={<UserCircle />} label="Assignee">
              Tereza Nováková
            </Property>
            <Property icon={<Tag />} label="Labels">
              Bug, Auth
            </Property>
            <Property icon={<CalendarDays />} label="Due">
              Nov 4
            </Property>
          </div>
          <div className="flex flex-col gap-2 text-sm leading-6 text-fg-muted">
            <p>
              After the session cookie expires, visiting any page sends the user
              to /login, which redirects back to the page because the refresh
              token is still valid. The browser stops after 20 redirects.
            </p>
            <p>
              Expected: refresh the session once, then render the page. If the
              refresh fails, show the login form.
            </p>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            variant="ghost"
            size="sm"
            icon={<Link2 />}
            className="mr-auto"
          >
            Copy link
          </Button>
          <SheetClose asChild>
            <Button size="sm">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
