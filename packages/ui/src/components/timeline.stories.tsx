import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  GitPullRequest,
  SmilePlus,
  Tag as TagIcon,
  UserPlus,
} from "lucide-react";
import { Avatar } from "./avatar";
import { Button, IconButton } from "./button";
import { StatusIcon } from "./issue-icons";
import {
  RelativeTime,
  Timeline,
  TimelineComment,
  TimelineItem,
} from "./timeline";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/**
 * The activity feed of an issue: one-line events (with the actor in bold and a relative
 * time) and comments in bubbles, joined by a thin line.
 */
const meta = {
  title: "Data display/Timeline",
  component: TimelineItem,
  tags: ["autodocs"],
  args: {
    icon: <Avatar name="Ada Lovelace" size="xs" />,
    children: (
      <>
        <strong>Ada Lovelace</strong> changed status from <strong>Todo</strong>{" "}
        to <strong>In Progress</strong>
      </>
    ),
    time: minutesAgo(42),
    last: true,
  },
  decorators: [
    (Story) => (
      <Timeline className="w-[520px]">
        <Story />
      </Timeline>
    ),
  ],
} satisfies Meta<typeof TimelineItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const EventKinds: Story = {
  render: () => (
    <>
      <TimelineItem
        icon={<Avatar name="Grace Hopper" size="xs" />}
        time={minutesAgo(60 * 26)}
      >
        <strong>Grace Hopper</strong> created the issue
      </TimelineItem>
      <TimelineItem icon={<UserPlus />} time={minutesAgo(60 * 25)}>
        <strong>Grace Hopper</strong> assigned to <strong>Ada Lovelace</strong>
      </TimelineItem>
      <TimelineItem icon={<TagIcon />} time={minutesAgo(60 * 25)}>
        <strong>Linear</strong> added label <strong>Bug</strong>
      </TimelineItem>
      <TimelineItem
        icon={<StatusIcon status="in_progress" label="" />}
        time={minutesAgo(180)}
      >
        <strong>Ada Lovelace</strong> moved from <strong>Todo</strong> to{" "}
        <strong>In Progress</strong>
      </TimelineItem>
      <TimelineItem icon={<GitPullRequest />} time={minutesAgo(12)} last>
        <strong>Ada Lovelace</strong> linked{" "}
        <strong>#2381 Retry uploads after reconnect</strong>
      </TimelineItem>
    </>
  ),
};

export const ActivityFeed: Story = {
  render: () => (
    <>
      <TimelineItem
        icon={<Avatar name="Grace Hopper" size="xs" />}
        time={minutesAgo(60 * 50)}
      >
        <strong>Grace Hopper</strong> created the issue
      </TimelineItem>
      <TimelineComment
        avatar={<Avatar name="Alan Turing" size="sm" />}
        author="Alan Turing"
        time={minutesAgo(60 * 30)}
        footer={
          <>
            <Button size="xs" variant="secondary">
              👀 2
            </Button>
            <IconButton label="Add reaction" size="xs">
              <SmilePlus />
            </IconButton>
          </>
        }
      >
        <p>
          Reproduced on iOS 18 with airplane mode toggled during a 40 MB upload.
          The queue never resumes because the retry timer is cleared on
          background.
        </p>
        <p>I think we need to persist the queue and resume on reconnect.</p>
      </TimelineComment>
      <TimelineItem
        icon={<StatusIcon status="in_progress" label="" />}
        time={minutesAgo(60 * 4)}
      >
        <strong>Ada Lovelace</strong> moved from <strong>Todo</strong> to{" "}
        <strong>In Progress</strong>
      </TimelineItem>
      <TimelineComment
        avatar={<Avatar name="Ada Lovelace" size="sm" />}
        author="Ada Lovelace"
        time={minutesAgo(25)}
        last
      >
        PR is up, persisting the queue in IndexedDB. Testing on Android next.
      </TimelineComment>
    </>
  ),
};

export const RelativeTimes: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="flex flex-col gap-1 text-sm">
      <RelativeTime date={minutesAgo(1)} />
      <RelativeTime date={minutesAgo(90)} />
      <RelativeTime date={minutesAgo(60 * 24 * 3)} />
      <RelativeTime date={minutesAgo(60 * 24 * 60)} />
    </div>
  ),
};
