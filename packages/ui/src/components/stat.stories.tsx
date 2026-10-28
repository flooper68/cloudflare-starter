import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bug, CheckCircle2, Clock, Users } from "lucide-react";
import { Sparkline, Stat } from "./stat";

const closed = [12, 18, 14, 22, 19, 25, 28, 24, 31, 29, 34, 38, 36, 42];
const cycleTime = [
  5.2, 4.9, 5.4, 4.6, 4.4, 4.8, 4.1, 3.9, 4.2, 3.7, 3.6, 3.8, 3.5, 3.4,
];
const bugs = [8, 9, 11, 10, 12, 14, 13, 15, 17, 16, 18, 21, 20, 23];

/**
 * A metric card: the number, its label, the change versus the previous period (green
 * when it is good, red when bad; set `invertDelta` when lower is better) and a sparkline.
 */
const meta = {
  title: "Data display/Stat",
  component: Stat,
  tags: ["autodocs"],
  args: {
    label: "Issues closed",
    value: "342",
    delta: 12.4,
    deltaLabel: "vs last cycle",
    invertDelta: false,
    sparkline: closed,
    bare: false,
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Deltas: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="grid w-[800px] grid-cols-3 gap-3">
      <Stat
        label="Throughput"
        value="342"
        delta={12.4}
        deltaLabel="vs last cycle"
      />
      <Stat
        label="Scope added"
        value="58"
        delta={-8}
        deltaLabel="vs last cycle"
      />
      <Stat
        label="Carry-over"
        value="11"
        delta={0}
        deltaLabel="vs last cycle"
      />
    </div>
  ),
};

export const LowerIsBetter: Story = {
  args: {
    label: "Median cycle time",
    value: "3.4d",
    delta: -18.2,
    invertDelta: true,
    sparkline: cycleTime,
    icon: <Clock />,
  },
};

export const WithoutSparkline: Story = {
  args: { sparkline: undefined, icon: <CheckCircle2 /> },
};

export const SparklineOnly: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="flex items-center gap-6">
      <Sparkline data={closed} label="Issues closed per day" />
      <Sparkline data={bugs} className="text-danger" area={false} />
      <Sparkline
        data={cycleTime}
        className="text-success"
        width={160}
        height={40}
      />
    </div>
  ),
};

export const Dashboard: Story = {
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="grid w-[880px] grid-cols-4 gap-3">
      <Stat
        icon={<CheckCircle2 />}
        label="Issues closed"
        value="342"
        delta={12.4}
        deltaLabel="vs last cycle"
        sparkline={closed}
      />
      <Stat
        icon={<Clock />}
        label="Median cycle time"
        value="3.4d"
        delta={-18.2}
        invertDelta
        deltaLabel="vs last cycle"
        sparkline={cycleTime}
      />
      <Stat
        icon={<Bug />}
        label="Open bugs"
        value="23"
        delta={15}
        invertDelta
        deltaLabel="vs last cycle"
        sparkline={bugs}
      />
      <Stat
        icon={<Users />}
        label="Active members"
        value="48"
        delta={0}
        deltaLabel="no change"
      />
    </div>
  ),
};
