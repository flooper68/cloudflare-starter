import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bug, Sparkles, Zap } from "lucide-react";
import { Badge, tones } from "./badge";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

/**
 * Badges label a state or a count. Choose the tone by meaning (`danger` for blocked,
 * `success` for shipped), `subtle` by default, `solid` only for the one thing that must
 * stand out, `outline` in dense tables.
 */
const meta = {
  title: "Data display/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "In review",
    tone: "accent",
    variant: "subtle",
    size: "md",
    dot: false,
  },
  argTypes: {
    tone: { control: "select", options: tones },
    variant: {
      control: "inline-radio",
      options: ["solid", "subtle", "outline"],
    },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["subtle", "solid", "outline"] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          <Badge variant={variant}>Backlog</Badge>
          <Badge variant={variant} tone="accent">
            Beta
          </Badge>
          <Badge variant={variant} tone="success">
            Shipped
          </Badge>
          <Badge variant={variant} tone="warning">
            At risk
          </Badge>
          <Badge variant={variant} tone="danger">
            Blocked
          </Badge>
          <Badge variant={variant} tone="info">
            Triage
          </Badge>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Badge size="sm" tone="accent">
        New
      </Badge>
      <Badge size="md" tone="accent">
        New
      </Badge>
    </div>
  ),
};

export const WithDotOrIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge dot tone="success">
        Operational
      </Badge>
      <Badge dot tone="warning">
        Degraded
      </Badge>
      <Badge dot tone="danger">
        Outage
      </Badge>
      <Badge icon={<Bug />} tone="danger">
        Bug
      </Badge>
      <Badge icon={<Sparkles />} tone="accent">
        Feature
      </Badge>
      <Badge icon={<Zap />} tone="warning" variant="outline">
        Performance
      </Badge>
    </div>
  ),
};

export const Counts: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-sm text-fg-muted">
      <span className="flex items-center gap-1.5">
        Inbox
        <Badge size="sm" tone="accent" variant="solid">
          12
        </Badge>
      </span>
      <span className="flex items-center gap-1.5">
        My issues <Badge size="sm">48</Badge>
      </span>
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Mobile app v3</CardTitle>
          <Badge dot tone="warning" size="sm">
            At risk
          </Badge>
        </div>
        <CardDescription>
          Offline sync slipped a week; 14 of 32 issues done.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};
