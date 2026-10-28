import type { Meta, StoryObj } from "@storybook/react-vite";
import { Clock, Mail } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { ProgressRing } from "./progress";

/**
 * A preview shown while hovering a link: a person, an issue, a project. It is not
 * reachable by keyboard or touch in a useful way, so it must only repeat information
 * the link's destination also shows.
 */
const meta = {
  title: "Overlays/HoverCard",
  component: HoverCardContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start" },
  argTypes: {
    side: {
      control: "inline-radio",
      options: ["top", "right", "bottom", "left"],
    },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
  },
  render: (args) => (
    <p className="text-sm text-fg-muted">
      Assigned to{" "}
      <HoverCard>
        <HoverCardTrigger
          href="#tereza"
          className="font-medium text-fg hover:underline"
        >
          Tereza Nováková
        </HoverCardTrigger>
        <HoverCardContent {...args}>
          <UserPreview />
        </HoverCardContent>
      </HoverCard>{" "}
      yesterday.
    </p>
  ),
} satisfies Meta<typeof HoverCardContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function UserPreview() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-subtle text-sm font-semibold text-accent">
          TN
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-fg">Tereza Nováková</span>
          <span className="text-xs text-fg-muted">
            Staff engineer · Platform
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs text-fg-muted [&_svg]:size-3.5">
        <span className="flex items-center gap-2">
          <Mail />
          tereza@acme.dev
        </span>
        <span className="flex items-center gap-2">
          <Clock />
          16:42 local time (Prague)
        </span>
      </div>
      <div className="flex gap-4 border-t border-line pt-3 text-xs text-fg-muted">
        <span>
          <span className="font-medium text-fg">12</span> assigned
        </span>
        <span>
          <span className="font-medium text-fg">4</span> in progress
        </span>
      </div>
    </div>
  );
}

export const Playground: Story = {};

/** Open by default, for the docs page. */
export const UserCard: Story = {
  render: (args) => (
    <div className="h-64">
      <HoverCard defaultOpen>
        <HoverCardTrigger
          href="#tereza"
          className="text-sm font-medium text-fg"
        >
          @tereza
        </HoverCardTrigger>
        <HoverCardContent {...args}>
          <UserPreview />
        </HoverCardContent>
      </HoverCard>
    </div>
  ),
};

/** Project preview on a project link. */
export const ProjectCard: Story = {
  render: (args) => (
    <div className="h-48">
      <HoverCard defaultOpen>
        <HoverCardTrigger
          href="#mobile"
          className="text-sm font-medium text-fg"
        >
          Mobile app v2
        </HoverCardTrigger>
        <HoverCardContent {...args} className="w-80">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Mobile app v2</span>
              <ProgressRing value={64} showValue label="Project progress" />
            </div>
            <p className="text-xs text-fg-muted">
              Rebuild onboarding and offline sync for iOS and Android. Target:
              Dec 12.
            </p>
            <span className="text-xs text-fg-subtle">
              Lead: Jakub Dvořák · 48 issues
            </span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  ),
};
